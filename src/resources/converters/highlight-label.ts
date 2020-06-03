export class HighlightLabelValueConverter {
  toView(isActive) {
    if (isActive) {
      return 1
    }
    else {
      return 0.3
    }
  }
}