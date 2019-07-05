import store from 'store/store';
import { State } from 'store/state';
import {produce, setAutoFreeze} from "immer";

setAutoFreeze(false)

export function selectProjection(state: State, projection: string) {
    const newState = produce(state, draftState => {
      draftState.selectedProjection = projection
    })

    return newState;
}

export function selectDataset(state: State, dataset: string) {
    const newState = produce(state, draftState => {
      draftState.selectedDataset = dataset
    })

    return newState;
}

store.registerAction('selectProjection', selectProjection);
store.registerAction('selectDataset', selectDataset);
