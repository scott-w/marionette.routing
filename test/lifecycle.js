import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {Route, createRouter, destroyRouter, middleware} from '../src/index';

let expect = chai.expect
chai.use(sinonChai)

let router, routes;
let RootRoute, ParentRoute, ChildRoute, GrandChildRoute, LeafRoute,
  Child2Route, DynParentRoute, DynChildRoute, DynGrandChildRoute;
let currentTransition

describe('Lifecycle hooks', () => {

  beforeEach(() => {
    router = createRouter({location: 'memory'});
    router.use(function (transition) {
      currentTransition = transition
    });
    router.use(middleware);
    RootRoute = Route.extend({}), ParentRoute = Route.extend({}), ChildRoute = Route.extend({}),
      GrandChildRoute = Route.extend({}), LeafRoute = Route.extend({}),
      Child2Route = Route.extend({}), DynParentRoute = Route.extend({}), DynChildRoute = Route.extend({}),
      DynGrandChildRoute = Route.extend({});


    routes = function (route) {
      route('parent', {routeClass: ParentRoute, routeOptions: {x: 1}, arbitrary: 3}, function () {
        route('child', {routeClass: ChildRoute}, function () {
          route('grandchild', {routeClass: GrandChildRoute}, function () {
            route('leaf', {routeClass: LeafRoute})
          })
        })
        route('child2', {routeClass: Child2Route})
      })
      route('root', {routeClass: RootRoute})
      route('dynparent', {routeClass: DynParentRoute}, function () {
        route('dynchild', {path: ':id', routeClass: DynChildRoute}, function () {
          route('dyngrandchild', {routeClass: DynGrandChildRoute})
        })
      })
    }
    router.map(routes);
    router.listen();
  })

  afterEach(() => {
    destroyRouter(router);
  })

  describe('router instance', () => {
    it('should be accessible in Route classes as $router', function () {
      let route = new Route();
      expect(route.$router).to.be.equal(router)
    })
  })

  describe('initialize', () => {

    it('should be called once with routeOptions', function (done) {
      let spy = sinon.spy(ParentRoute.prototype, 'initialize');
      router.transitionTo('parent').then(function () {
        expect(spy).to.be.calledOnce;
        expect(spy).to.be.calledWith({x: 1})
        done()
      }).catch(done)
    });

    it('should be called once even when enter route a second time', function (done) {
      let spy = sinon.spy(RootRoute.prototype, 'initialize')
      router.transitionTo('root').then(function () {
        return router.transitionTo('parent');
      }).then(function () {
        return router.transitionTo('root');
      }).then(function () {
        expect(spy).to.have.been.calledOnce;
        done();
      }).catch(done);
    })

    it('should be called in order from root to leave once', function (done) {
      let parentSpy = sinon.spy(ParentRoute.prototype, 'initialize');
      let childSpy = sinon.spy(ChildRoute.prototype, 'initialize');
      let grandChildSpy = sinon.spy(GrandChildRoute.prototype, 'initialize');
      let leafSpy = sinon.spy(LeafRoute.prototype, 'initialize');
      router.transitionTo('leaf').then(function () {
        return router.transitionTo('root')
      }).then(function () {
        return router.transitionTo('leaf');
      }).then(function () {
        //once
        expect(parentSpy).to.have.been.calledOnce;
        expect(childSpy).to.have.been.calledOnce;
        expect(grandChildSpy).to.have.been.calledOnce;
        expect(leafSpy).to.have.been.calledOnce;
        //order
        expect(childSpy).to.have.been.calledAfter(parentSpy);
        expect(grandChildSpy).to.have.been.calledAfter(childSpy);
        expect(leafSpy).to.have.been.calledAfter(grandChildSpy);
        done()
      }).catch(done)
    })

    it('should allow to access $config property', function () {
      ParentRoute.prototype.initialize = function() {
        expect(this.$config).to.be.defined
        expect(this.$config.name).to.be.equal('parent')
        expect(this.$config.path).to.be.equal('parent')
        expect(this.$config.options).to.be.defined
        expect(this.$config.options.arbitrary).to.be.equal(3)
      }
      return router.transitionTo('parent')
    })
  });

  describe('activate', () => {
    it('should be called once with transition when enter route', function (done) {
      let spy = sinon.spy(ParentRoute.prototype, 'activate');
      router.transitionTo('parent').then(function () {
        expect(spy).to.be.calledOnce;
        expect(spy).to.be.calledWith(currentTransition)
        done()
      }).catch(done)
    });

    it('should be called twice when enter route a second time', function (done) {
      let spy = sinon.spy(RootRoute.prototype, 'activate')
      router.transitionTo('root').then(function () {
        return router.transitionTo('parent');
      }).then(function () {
        return router.transitionTo('root');
      }).then(function () {
        expect(spy).to.have.been.calledTwice;
        done();
      }).catch(done);
    })

    it('should be called in order from root to leaf, once', function (done) {
      let parentSpy = sinon.spy(ParentRoute.prototype, 'activate');
      let childSpy = sinon.spy(ChildRoute.prototype, 'activate');
      let grandChildSpy = sinon.spy(GrandChildRoute.prototype, 'activate');
      let leafSpy = sinon.spy(LeafRoute.prototype, 'activate');
      router.transitionTo('leaf').then(function () {
        //once
        expect(parentSpy).to.have.been.calledOnce;
        expect(childSpy).to.have.been.calledOnce;
        expect(grandChildSpy).to.have.been.calledOnce;
        expect(leafSpy).to.have.been.calledOnce;
        //order
        expect(childSpy).to.have.been.calledAfter(parentSpy);
        expect(grandChildSpy).to.have.been.calledAfter(childSpy);
        expect(leafSpy).to.have.been.calledAfter(grandChildSpy);
        done()
      }).catch(done)
    })

    it('should not be called if transition is canceled in a parent route', function (done) {
      let parentSpy = sinon.spy(ParentRoute.prototype, 'activate');
      let childStub = sinon.stub(ChildRoute.prototype, 'activate', function (transition) {
        transition.cancel()
      });
      let grandChildSpy = sinon.spy(GrandChildRoute.prototype, 'activate');
      let leafSpy = sinon.spy(LeafRoute.prototype, 'activate');
      router.transitionTo('leaf').then(function () {
        done('Transition promise should be rejected')
      }).catch(function () {
        expect(parentSpy).to.have.been.calledOnce;
        expect(childStub).to.have.been.calledOnce;
        expect(grandChildSpy).to.not.have.been.called;
        expect(leafSpy).to.not.have.been.called;
        done()
      })
    })

    it('should be called when child route change to a route with some parent', function (done) {
      let parentSpy;
      let child2Spy;
      router.transitionTo('child').then(function () {
        parentSpy = sinon.spy(ParentRoute.prototype, 'activate');
        child2Spy = sinon.spy(Child2Route.prototype, 'activate');
        return router.transitionTo('child2')
      }).then(function () {
        expect(parentSpy).to.not.be.called;
        expect(child2Spy).to.be.calledOnce;
        done()
      }).catch(done)
    });

    it('should be called when a route param changes', function (done) {
      let parentSpy, childSpy, grandChildSpy;
      router.transitionTo('dyngrandchild', {id: 1}).then(function () {
        parentSpy = sinon.spy(DynParentRoute.prototype, 'activate');
        childSpy = sinon.spy(DynChildRoute.prototype, 'activate');
        grandChildSpy = sinon.spy(DynGrandChildRoute.prototype, 'activate');
        return router.transitionTo('dyngrandchild', {id: 2})
      }).then(function () {
        expect(parentSpy).to.not.be.called;
        expect(childSpy).to.be.calledOnce;
        expect(grandChildSpy).to.be.calledOnce;
        done()
      }).catch(done)
    });
  });

  describe('deactivate', () => {
    it('should be called once with transition when leave route', function (done) {
      let spy = sinon.spy(ParentRoute.prototype, 'deactivate');
      router.transitionTo('parent').then(function () {
        return router.transitionTo('root')
      }).then(function () {
        expect(spy).to.be.calledOnce;
        expect(spy).to.be.calledWith(currentTransition)
        done()
      }).catch(done)
    });

    it('should be called twice when leave route a second time', function (done) {
      let spy = sinon.spy(RootRoute.prototype, 'deactivate')
      router.transitionTo('root').then(function () {
        return router.transitionTo('parent');
      }).then(function () {
        return router.transitionTo('root');
      }).then(function () {
        return router.transitionTo('parent');
      }).then(function () {
        expect(spy).to.have.been.calledTwice;
        done();
      }).catch(done);
    })

    it('should be called in order from leaf to root, once', function (done) {
      let parentSpy = sinon.spy(ParentRoute.prototype, 'deactivate');
      let childSpy = sinon.spy(ChildRoute.prototype, 'deactivate');
      let grandChildSpy = sinon.spy(GrandChildRoute.prototype, 'deactivate');
      let leafSpy = sinon.spy(LeafRoute.prototype, 'deactivate');
      router.transitionTo('leaf').then(function () {
        return router.transitionTo('root')
      }).then(function () {
        //once
        expect(parentSpy).to.have.been.calledOnce;
        expect(childSpy).to.have.been.calledOnce;
        expect(grandChildSpy).to.have.been.calledOnce;
        expect(leafSpy).to.have.been.calledOnce;
        //order
        expect(grandChildSpy).to.have.been.calledAfter(leafSpy);
        expect(childSpy).to.have.been.calledAfter(grandChildSpy);
        expect(parentSpy).to.have.been.calledAfter(childSpy);
        done()
      }).catch(done)
    })

    it('should not be called if transition is canceled in a child route', function (done) {
      let parentSpy = sinon.spy(ParentRoute.prototype, 'deactivate');
      let childStub = sinon.stub(ChildRoute.prototype, 'deactivate', function (transition) {
        transition.cancel()
      });
      let grandChildSpy = sinon.spy(GrandChildRoute.prototype, 'deactivate');
      let leafSpy = sinon.spy(LeafRoute.prototype, 'deactivate');
      router.transitionTo('leaf').then(function () {
        return router.transitionTo('root')
      }).then(function () {
        done('Transition promise should be rejected')
      }).catch(function () {
        expect(parentSpy).to.not.have.been.called;
        expect(childStub).to.have.been.calledOnce;
        expect(grandChildSpy).to.have.been.calledOnce;
        expect(leafSpy).to.have.been.calledOnce;
        done()
      })
    })

    it('should be called when child route change to a route with some parent', function (done) {
      let parentSpy;
      let childSpy;
      router.transitionTo('child').then(function () {
        parentSpy = sinon.spy(ParentRoute.prototype, 'deactivate');
        childSpy = sinon.spy(ChildRoute.prototype, 'deactivate');
        return router.transitionTo('child2')
      }).then(function () {
        expect(parentSpy).to.not.be.called;
        expect(childSpy).to.be.calledOnce;
        done()
      }).catch(done)
    });

    it('should be called when a route param changes', function (done) {
      let parentSpy, childSpy, grandChildSpy;
      router.transitionTo('dyngrandchild', {id: 1}).then(function () {
        parentSpy = sinon.spy(DynParentRoute.prototype, 'deactivate');
        childSpy = sinon.spy(DynChildRoute.prototype, 'deactivate');
        grandChildSpy = sinon.spy(DynGrandChildRoute.prototype, 'deactivate');
        return router.transitionTo('dyngrandchild', {id: 2})
      }).then(function () {
        expect(parentSpy).to.not.be.called;
        expect(childSpy).to.be.calledOnce;
        expect(grandChildSpy).to.be.calledOnce;
        done()
      }).catch(done)
    });
  });


});
