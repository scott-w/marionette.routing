# Router Configuration

## `createRouter(options)`

 Returns a router instance. Accepts an options hash as argument:

| Option | Default | Description |
|--------|---------|-------------|
| `log`  | `noop` | Called with logging info - takes `true`, `false` or a custom logging function |
| `logError` | `true` | Called when transitions error (except `TransitionRedirected` and `TransitionCancelled`). Takes `true`, `false`, or a custom function |
| `pushState` | `false` | Use browser History API or the default hash change |
| `root` | `/` | Used in combination with `pushState: true` - if your app isn't served from `/`, pass the new root |
| `interceptLinks` | (same as `pushState`) | When `pushState: true` this intercepts all link clicks, preventing the default behavior. This can take a function to set custom behavior - see [intercepting links](#intercepting-links) |
| `qs` | `object` | The parser function for query strings with a simple parser. Pass in an object with `parse` and `stringify` functions to customize the handling of query strings. |
| `promise` | `window.Promise` | The Promises implementation to use for transitions |


## `router.map(fn)`

Configure the router with a route map. e.g.

```js
router.map(function (route) {
  route('app', {path: '/', abstract: true}, function () {
    route('about', {viewClass: AboutView, viewOptions: {version: '1.0'}})
    route('post', {path: ':postId', routeClass: PostRoute}, function () {
      route('edit', {routeClass: PostRoute, viewClass: EditPostView})
    })
  })
})
```

Each route can be configure with the following options:

 * `routeClass`: a [`Route`](./route.md) class
 * `routeOptions`: options passed to the Route constructor
 * `viewClass`: a `Marionette.View` class. Can be used alone or with `routeClass`
 * `viewOptions`: options passed to the Marionette.View constructor
 * `path`: the route path
 * `abstract`: pass true to define an abstract route
 * `outlet`: pass true to allow a viewClass without an `outlet` region

**All routes must have at least viewClass or routeClass defined.**

For more information about route mapping refer to cherrytree documentation

## `router.listen`

 Starts listening for URL changes

## `router.rootRegion`

 Property that defines the region where the top level views will be rendered

## `middleware`

  A cherrytree middleware to be used by the route. May be removed from public interface in the future.

## `destroyRouter(routerInstance)`

  Cleanup a router. This is mostly used for testing.
