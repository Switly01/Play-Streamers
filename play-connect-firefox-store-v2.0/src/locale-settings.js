export const LOCALE_CURRENCIES = Object.freeze({tr:'TRY',en:'USD',de:'EUR',es:'EUR',fr:'EUR',ru:'RUB',ar:'SAR',ja:'JPY'});
export const CURRENCIES = ['TRY','USD','EUR','GBP','RUB','SAR','JPY','BRL','IDR','PLN','KRW'];
export function localeCurrency(locale) { return LOCALE_CURRENCIES[locale] || 'TRY'; }
