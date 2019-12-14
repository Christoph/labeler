export class CustomSortLengthValueConverter {
  toView(array, config) {
    let factor = (config.direction || "ascending") === "ascending" ? 1 : -1;
    return array.sort((a, b) => {
      return (a[config.propertyName].length - b[config.propertyName].length) * factor;
    });
  }
}
