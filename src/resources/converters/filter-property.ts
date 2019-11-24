export class FilterPropertyValueConverter {
    toView(array, active, property) {
        return array.filter((item) => {
            let f = !active ? !item[property] : true;
            return f
        });
    }
}