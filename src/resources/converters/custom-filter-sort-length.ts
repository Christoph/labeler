export class CustomFilterSortLengthValueConverter {
  toView(array, config) {
    let factor = (config.direction || "ascending") === "ascending" ? 1 : -1;
    return array.sort((a, b) => {
      let first = a[config.filterName] === config.filterValue ? 0 : a[config.propertyName].length;
      let second = b[config.filterName] === config.filterValue ? 0 : b[config.propertyName].length;

      return (first - second) * factor;
    });
  }
}
