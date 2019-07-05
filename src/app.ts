import { autoinject } from 'aurelia-dependency-injection';
import { DataStore } from 'data-store';

import { connectTo, dispatchify  } from 'aurelia-store';
import { State } from 'store/state';
import { selectProjection, selectDataset } from 'store/actions/data';


@autoinject()
@connectTo()
export class App {

}
