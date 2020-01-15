import * as moment from 'moment';

export class TimeFormatValueConverter {
    toView(value) {
        return moment("2015-01-01").startOf('day')
            .seconds(value)
            .format('H:mm:ss');
    }
}


