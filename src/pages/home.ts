import {
    autoinject
} from 'aurelia-dependency-injection';
import {
    DataStore
} from 'data-store';
import * as _ from 'lodash';
import { computedFrom } from 'aurelia-framework';
import * as tfidf from 'tiny-tfidf';
import * as porter from 'wink-porter2-stemmer';
import * as distances from 'wink-distance';

@autoinject()
export class Home {
}