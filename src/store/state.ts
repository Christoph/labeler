export interface State {
    selectedProjection: string;
    selectedDataset: string;
}

export const initialState: State = {
    selectedProjection: "mds",
    selectedDataset: "single keywords"
};
