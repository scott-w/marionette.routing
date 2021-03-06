/**
 * Marionette Routing
 *
 * Copyright © 2015-2016 Luiz Américo Pereira Câmara. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import _ from 'underscore'
import Radio from 'backbone.radio'
import cherrytree from 'cherrytree'
import Route from './route'

let mnRouteMap = Object.create(null)
export const routerChannel = Radio.channel('router')
let router

export function createRouter(options) {
  if (router) {
    throw new Error('Instance of router already created')
  }
  return router = Route.prototype.$router = cherrytree(options)
}

export function destroyRouter(instance) {
  router = null
  Route.prototype.$router = null
  mnRouteMap = Object.create(null)
  instance.destroy()
}

export function getMnRoutes(routes) {
  return routes.map(function (route) {
    return mnRouteMap[route.name]
  })
}

routerChannel.reply('transitionTo', function () {
  return router.transitionTo.apply(router, arguments)
})

routerChannel.reply('isActive', function () {
  return router.isActive.apply(router, arguments)
})

routerChannel.reply('generate', function () {
  return router.generate.apply(router, arguments)
})

routerChannel.reply('goBack', function () {
  //in wait of a better implementation
  history.back();
})

function getChangingIndex(prevRoutes, currentRoutes){
  var index, prev, current;
  const count = Math.max(prevRoutes.length, currentRoutes.length)
  for (index = 0; index < count; index++) {
    prev = prevRoutes[index]
    current = currentRoutes[index]
    if (!(prev && current) || (prev.name !== current.name) || !_.isEqual(prev.params, current.params)) {
      break
    }
  }
  return index
}

function findRouteConfig(routeName, index, routes) {
  let parentRoutes = routes.slice(0, index).reverse().map(function (route) {
    return mnRouteMap[route.name]
  })
  let config
  parentRoutes.some(function (route) {
    let childRoutes = _.result(route, 'childRoutes')
    config = childRoutes && childRoutes[routeName]
    if (_.isFunction(config) && !(config.prototype instanceof Route)) {
      config = config.call(route)
    }
    return config
  })
  return config
}

function createRouteInstance(options, config) {
  if (options.prototype instanceof Route) {
    return new options(undefined, config)
  }
  let routeOptions = _.extend({}, options.routeOptions, _.pick(options, ['viewClass', 'viewOptions']))
  if (options.routeClass) {
    return new options.routeClass(routeOptions, config)
  } else if (options.viewClass) {
    return new Route(routeOptions, config)
  }
}

function createMnRoute(route, index, routes) {
  let instanceConfig = {
    name: route.name,
    path: route.path,
    options: _.clone(route.options)
  }
  let instance = createRouteInstance(route.options, instanceConfig)
  if (!instance) {
    let routeConfig = findRouteConfig(route.name, index, routes)
    return Promise.resolve(routeConfig).then(function (options) {
      return options && createRouteInstance(options, instanceConfig)
    })
  }
  return instance
}

function getParentRegion(routes, route) {
  var region, parent
  let routeIndex = routes.indexOf(route) - 1
  while (routeIndex >= 0) {
    parent = routes[routeIndex]
    if (parent.view && parent.$config.options.outlet !== false) {
      region = parent.getOutlet()
      if (region) {
        return region
      } else {
        throw new Error(`No outlet region defined in ${parent.$config.name} route`)
      }
    }
    routeIndex--
  }
  return router.rootRegion
}

export function middleware(transition) {

  routerChannel.trigger('before:transition', transition)

  if (transition.isCancelled) return ;

  let prevRoutes = transition.prev.routes
  let changingIndex = getChangingIndex(prevRoutes, transition.routes)
  var routeIndex, routeInstance, deactivated = []

  //deactivate previous routes
  for (routeIndex = prevRoutes.length - 1; routeIndex >= changingIndex; routeIndex--) {
    routeInstance = mnRouteMap[prevRoutes[routeIndex].name]
    if (routeInstance) {
      deactivated.push(routeInstance)
    }
  }

  if (deactivated.some(function (route) {
      routerChannel.trigger('before:deactivate', transition, route)
      return transition.isCancelled
    })) return

  if (deactivated.some(function (route) {
      route.deactivate(transition)
      routerChannel.trigger('deactivate', transition, route)
      return transition.isCancelled
    })) return

  //build route tree and creating instances if necessary
  let mnRoutes = transition.mnRoutes = []

  let promise = transition.routes.reduce(function (acc, route, i, routes) {
    return acc.then(function (res) {
      let instance = mnRouteMap[route.name]
      if (instance) {
        res.push(instance)
        return res
      } else {
        instance = createMnRoute(route, i, routes)
        return Promise.resolve(instance).then(function (mnRoute) {
          if (!mnRoute) {
            throw new Error(`Unable to create route ${route.name}: routeClass or viewClass must be defined`)
          }
          mnRouteMap[route.name] = mnRoute
          res.push(mnRoute)
          return res
        })
      }
    });
  }, Promise.resolve(mnRoutes));

  //activate routes in order
  let activated

  promise = promise.then(function () {
    activated = mnRoutes.slice(changingIndex)
    return activated.reduce(function (prevPromise, mnRoute) {
      routerChannel.trigger('before:activate', transition, mnRoute)
      return prevPromise.then(function () {
        if (!transition.isCancelled) {
          return Promise.resolve(mnRoute.activate(transition)).then(function () {
            if (!transition.isCancelled) {
              routerChannel.trigger('activate', transition, mnRoute)
            }
          })
        }
        return Promise.resolve()
      })
    }, Promise.resolve())
  })

  transition.then(function () {
    router.state.mnRoutes = mnRoutes
    routerChannel.trigger('transition', transition)
  }).catch(function (err) {
    if (err.type !== 'TransitionCancelled' && err.type !== 'TransitionRedirected') {
      routerChannel.trigger('transition:error', transition, err)
    }
  })

  //render views
  return promise.then(function () {
    if (transition.isCancelled) return ;
    //ensure at least the target (last) route is rendered
    if (!activated.length && mnRoutes.length) {
      activated.push(mnRoutes[mnRoutes.length - 1])
    }

    let renderQueue = activated.reduce(function (memo, mnRoute) {
      if (mnRoute.viewClass) {
        if (memo.length && memo[memo.length - 1].$config.options.outlet === false) {
          memo.pop()
        }
        memo.push(mnRoute)
      }
      return memo
    }, [])

    renderQueue.forEach(function (mnRoute) {
      let parentRegion = getParentRegion(mnRoutes, mnRoute)
      mnRoute.renderView(parentRegion, transition)
    })
  })
}