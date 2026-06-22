// Function to get the nth weekday of a month
// dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
// n: 1=1st, 2=2nd, ..., 5=last
function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
    const date = new Date(year, month, 1);
    let count = 0;
    
    if (n < 5) { // 1st, 2nd, 3rd, 4th
        while (date.getMonth() === month) {
            if (date.getDay() === dayOfWeek) {
                count++;
                if (count === n) {
                    return date;
                }
            }
            date.setDate(date.getDate() + 1);
        }
    } else { // Last
        const lastDay = new Date(year, month + 1, 0);
        while (lastDay.getMonth() === month) {
            if (lastDay.getDay() === dayOfWeek) {
                return lastDay;
            }
            lastDay.setDate(lastDay.getDate() - 1);
        }
    }
    return new Date(); // Should not happen
}

export function getUSPublicHolidays(year: number): { name: string, date: Date }[] {
    const holidays = [
        // New Year's Day
        { name: "New Year's Day", date: new Date(year, 0, 1) },
        
        // Martin Luther King, Jr. Day (Third Monday in January)
        { name: "Martin Luther King, Jr. Day", date: getNthWeekdayOfMonth(year, 0, 1, 3) },
        
        // Presidents' Day (Third Monday in February)
        { name: "Presidents' Day", date: getNthWeekdayOfMonth(year, 1, 1, 3) },
        
        // Memorial Day (Last Monday in May)
        { name: "Memorial Day", date: getNthWeekdayOfMonth(year, 4, 1, 5) },

        // Juneteenth
        { name: "Juneteenth", date: new Date(year, 5, 19) },
        
        // Independence Day
        { name: "Independence Day", date: new Date(year, 6, 4) },
        
        // Labor Day (First Monday in September)
        { name: "Labor Day", date: getNthWeekdayOfMonth(year, 8, 1, 1) },

        // Columbus Day (Second Monday in October)
        { name: "Columbus Day", date: getNthWeekdayOfMonth(year, 9, 1, 2) },
        
        // Veterans Day
        { name: "Veterans Day", date: new Date(year, 10, 11) },
        
        // Thanksgiving Day (Fourth Thursday in November)
        { name: "Thanksgiving Day", date: getNthWeekdayOfMonth(year, 10, 4, 4) },
        
        // Christmas Day
        { name: "Christmas Day", date: new Date(year, 11, 25) },
    ];
    
    // Adjust for weekends
    return holidays.map(h => {
        const day = h.date.getDay();
        if (day === 0) { // Sunday, move to Monday
            h.date.setDate(h.date.getDate() + 1);
        } else if (day === 6) { // Saturday, move to Friday
            h.date.setDate(h.date.getDate() - 1);
        }
        return h;
    });
}
