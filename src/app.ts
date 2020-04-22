import { autoinject } from 'aurelia-dependency-injection';
import { PLATFORM } from "aurelia-framework";

@autoinject()
export class App {
  router;
  configureRouter(config, router) {
    this.router = router;
    config.title = 'LAssi';
    config.map([
      { route: ['', 'home'], name: 'home', moduleId: PLATFORM.moduleName('pages/home') },
      { route: 'A', name: 'A', moduleId: PLATFORM.moduleName('pages/p0'), title: 'A' },
      { route: 'B', name: 'B', moduleId: PLATFORM.moduleName('pages/p1'), title: 'B' },
      { route: 'C', name: 'C', moduleId: PLATFORM.moduleName('pages/p2'), title: 'C' }
    ]);
  }
}
