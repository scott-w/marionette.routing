import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {Route, RouterLink, createRouter, destroyRouter, middleware} from '../src/index';
import Mn from 'backbone.marionette';

let expect = chai.expect;
chai.use(sinonChai);


let router, routes;
let RootRoute, ParentRoute, ChildRoute, GrandChildRoute, LeafRoute, PreRenderedView;

let ParentView = Mn.View.extend({
  behaviors: [{
    behaviorClass: RouterLink,
    defaults: {
      child: {
        query: {
          foo: 'bar'
        }
      },
      root: {
        params: function(){
          return {id: this.rootId}
        },
        query: function (el) {
          if (el.id === 'a-rootlink3') return {tag: el.tagName}
        }
      }
    }
  }],
  template: function () {
    return `<div id="div-rootlink1" route="root" param-id="1"></div>
      <div id="div-grandchildlink" route="grandchild" query-name="test"></div>
      <div id="div-parentlink" route="parent"><div id="innerparent"></div> </div>
      <a id="a-rootlink2" route="root" param-id="2"></a>
      <a id="a-rootlink3" route="root"></a>
      <div id="scoped">
        <a id="a-parentlink" route="parent"></a>
        <a id="a-grandchildlink" route="grandchild" query-name="test"></a>
      </div>      
      <a id="a-childlink" route="child" query-name="test"></a>
      <div id="div-a-parent" route="parent"><a id="childanchor"></a><a id="childanchor2"></a><div><a id="childanchor3"></a></div></div>
      <div class="child-view"></div>
     `
  },
  regions: {
    outlet: '.child-view'
  },
  rootId: 5
});

let GrandChildView = Mn.View.extend({
  tagName: 'h2',
  template: function () {
    return 'GrandChild'
  }
});

describe('RouterLink', () => {

  beforeEach(() => {
    router = createRouter();
    router.use(middleware);
    ParentRoute = Route.extend({
      viewClass: ParentView
    });
    RootRoute = Route.extend({}), ChildRoute = Route.extend({}),
      GrandChildRoute = Route.extend({}), LeafRoute = Route.extend({});
    routes = function (route) {
      route('parent', {routeClass: ParentRoute}, function () {
        route('child', {routeClass: ChildRoute}, function () {
          route('grandchild', {viewClass: GrandChildView})
        })
      });
      route('root', {path: 'root/:id', routeClass: RootRoute, routeOptions: {viewClass: ParentView}});
    };
    router.map(routes);

    document.body.innerHTML = `<div id="main"></div>
      <div id="prerendered">
      <a id="a-prerootlink2" route="root" param-id="2"></a>
      <a id="a-preparentlink" route="parent"></a>
      <a id="a-pregrandchildlink" route="grandchild" query-name="test"></a>
      </div>`;
    let RootRegion = Mn.Region.extend({
      el: '#main'
    });
    router.rootRegion = new RootRegion()

    router.listen();
  });

  afterEach(() => {
    destroyRouter(router);
    document.location.pathname = ''
    document.location.hash = ''
  });

  it('should generate href attributes in anchor tags with route attribute', function () {
    return router.transitionTo('parent').then(function () {
      expect($('#a-parentlink').attr('href')).to.be.equal('#parent')
      expect($('#a-rootlink2').attr('href')).to.be.equal('#root/2')
      expect($('#a-grandchildlink').attr('href')).to.be.equal('#parent/child/grandchild?name=test')
    })
  })

  it.skip('should update href attributes in anchor tags when attribute is changed', function () {
    return router.transitionTo('parent').then(function () {
      let rootLink = $('#a-rootlink2')
      let grandChildLink = $('#a-grandchildlink')
      rootLink.attr('param-id', '3')
      grandChildLink.attr('query-other', 'boo')
      expect(rootLink.attr('href')).to.be.equal('#root/3')
      expect(grandChildLink.attr('href')).to.be.equal('#parent/child/grandchild?name=test&other=boo')
    })
  })

  it('should generate href attributes in first child anchor of a element with route attribute', function () {
    return router.transitionTo('parent').then(function () {
      expect($('#childanchor').attr('href')).to.be.equal('#parent')
      expect($('#childanchor2').attr('href')).to.be.equal(undefined)
      expect($('#childanchor3').attr('href')).to.be.equal(undefined)
    })
  })

  it('should use defaults defined in behavior options', function () {
    return router.transitionTo('parent').then(function () {
      expect($('#a-childlink').attr('href')).to.be.equal('#parent/child?foo=bar&name=test')
      expect($('#a-rootlink3').attr('href')).to.be.equal('#root/5?tag=A')
    })
  })

  it('should call transitionTo when a non anchor tags with route attribute is clicked', function () {
    return router.transitionTo('parent').then(function () {
      let spy = sinon.spy(router, 'transitionTo')
      $('#div-rootlink1').click()
      expect(spy).to.be.calledOnce.and.calledWithExactly('root', {'id': '1'}, {})

      spy.reset()
      $('#div-grandchildlink').click()
      expect(spy).to.be.calledOnce.and.calledWithExactly('grandchild', {}, {name: 'test'})

      spy.reset()
      $('#innerparent').click()
      expect(spy).to.be.calledOnce.and.calledWithExactly('parent', {}, {})
    })
  })

  it('should not call transitionTo when a non anchor tags with route attribute with an anchor descendant is clicked', function () {
    return router.transitionTo('parent').then(function () {
      let spy = sinon.spy(router, 'transitionTo')
      $('#div-a-parent').click()
      expect(spy).not.to.be.called
    })
  })

  it('should set active class in tag with route attribute when respective route is active', function () {
    return router.transitionTo('parent').then(function () {
      //this handler will be called before middleware one. PostPone actual test
      return Promise.resolve()
    }).then(function () {
      expect($('#a-parentlink').hasClass('active')).to.be.true
      expect($('#div-parentlink').hasClass('active')).to.be.true
      expect($('#a-rootlink2').hasClass('active')).to.be.false
      expect($('#div-rootlink1').hasClass('active')).to.be.false
      expect($('#a-grandchildlink').hasClass('active')).to.be.false
      expect($('#div-grandchildlink').hasClass('active')).to.be.false
      return router.transitionTo('root', {id: '1'})
    }).then(function () {
      expect($('#a-parentlink').hasClass('active')).to.be.false
      expect($('#div-parentlink').hasClass('active')).to.be.false
      expect($('#a-rootlink2').hasClass('active')).to.be.false
      expect($('#div-rootlink1').hasClass('active')).to.be.true
      expect($('#a-grandchildlink').hasClass('active')).to.be.false
      expect($('#div-grandchildlink').hasClass('active')).to.be.false
      return router.transitionTo('grandchild', null, {name: 'test'})
    }).then(function () {
      expect($('#a-parentlink').hasClass('active')).to.be.true
      expect($('#div-parentlink').hasClass('active')).to.be.true
      expect($('#a-rootlink2').hasClass('active')).to.be.false
      expect($('#div-rootlink1').hasClass('active')).to.be.false
      expect($('#a-grandchildlink').hasClass('active')).to.be.true
      expect($('#div-grandchildlink').hasClass('active')).to.be.true
    })
  })

  describe('in a pre-rendered view', function () {

    beforeEach(function () {
      PreRenderedView = Mn.View.extend({
        behaviors: [RouterLink],
        el: $('#prerendered')
      })

      ParentRoute.prototype.viewClass = PreRenderedView

      ParentRoute.prototype.viewOptions = {x: 1}
    })

    it('should generate href attributes in anchor tags with route attribute', function () {
      return router.transitionTo('parent').then(function () {
        expect($('#a-preparentlink').attr('href')).to.be.equal('#parent')
        expect($('#a-prerootlink2').attr('href')).to.be.equal('#root/2')
        expect($('#a-pregrandchildlink').attr('href')).to.be.equal('#parent/child/grandchild?name=test')
      })
    })

    it('should call view.initialize with proper arguments', function () {
      let spy = PreRenderedView.prototype.initialize = sinon.spy()
      return router.transitionTo('parent').then(function () {
        expect(spy).to.be.calledOnce
        expect(spy).to.be.calledWith({x: 1})
      })
    })

  })

  describe('with rootEl set', function () {

    beforeEach(function () {
      ParentView.prototype.behaviors = [{behaviorClass: RouterLink, rootEl: '#scoped'}]
    })

    it('should generate href attributes only in children of rootEl', function () {
      return router.transitionTo('parent').then(function () {
        expect($('#a-parentlink').attr('href')).to.be.equal('#parent')
        expect($('#a-rootlink2').attr('href')).to.be.equal(undefined)
        expect($('#a-grandchildlink').attr('href')).to.be.equal('#parent/child/grandchild?name=test')
      })
    })
  })
});

