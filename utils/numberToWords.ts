const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

const thousands = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];

function convertLessThanOneThousand(n: number, isFeminine: boolean = false): string {
  const result: string[] = [];

  if (n >= 100) {
    result.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }

  if (n >= 20) {
    result.push(tens[Math.floor(n / 10)]);
    n %= 10;
  } else if (n >= 10) {
    result.push(teens[n - 10]);
    n = 0;
  }

  if (n > 0) {
    result.push(isFeminine ? thousands[n] : units[n]);
  }

  return result.filter(x => x).join(' ');
}

function getThousandWord(n: number): string {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'тысяч';
  }

  if (lastDigit === 1) return 'тысяча';
  if (lastDigit >= 2 && lastDigit <= 4) return 'тысячи';
  return 'тысяч';
}

function getMillionWord(n: number): string {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'миллионов';
  }

  if (lastDigit === 1) return 'миллион';
  if (lastDigit >= 2 && lastDigit <= 4) return 'миллиона';
  return 'миллионов';
}

function getCurrencyWord(n: number): string {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'тенге';
  }

  if (lastDigit === 1) return 'тенге';
  if (lastDigit >= 2 && lastDigit <= 4) return 'тенге';
  return 'тенге';
}

function getTiynWord(n: number): string {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'тиын';
  }

  if (lastDigit === 1) return 'тиын';
  if (lastDigit >= 2 && lastDigit <= 4) return 'тиына';
  return 'тиын';
}

export function numberToWords(num: number): string {
  if (num === 0) return 'ноль тенге 00 тиын';

  const isNegative = num < 0;
  num = Math.abs(num);

  const wholePart = Math.floor(num);
  const fractionalPart = Math.round((num - wholePart) * 100);

  const result: string[] = [];

  if (isNegative) {
    result.push('минус');
  }

  if (wholePart === 0) {
    result.push('ноль');
  } else {
    const millions = Math.floor(wholePart / 1000000);
    const thousands = Math.floor((wholePart % 1000000) / 1000);
    const remainder = wholePart % 1000;

    if (millions > 0) {
      result.push(convertLessThanOneThousand(millions));
      result.push(getMillionWord(millions));
    }

    if (thousands > 0) {
      result.push(convertLessThanOneThousand(thousands, true));
      result.push(getThousandWord(thousands));
    }

    if (remainder > 0 || (millions === 0 && thousands === 0)) {
      result.push(convertLessThanOneThousand(remainder));
    }
  }

  result.push(getCurrencyWord(wholePart));

  const tiynStr = fractionalPart.toString().padStart(2, '0');
  result.push(tiynStr);
  result.push(getTiynWord(fractionalPart));

  let resultStr = result.filter(x => x).join(' ');
  resultStr = resultStr.charAt(0).toUpperCase() + resultStr.slice(1);

  return resultStr;
}

export function numberToWordsShort(num: number): string {
  if (num === 0) return 'Ноль';

  const isNegative = num < 0;
  num = Math.abs(num);

  const wholePart = Math.floor(num);

  const result: string[] = [];

  if (isNegative) {
    result.push('минус');
  }

  if (wholePart === 0) {
    result.push('ноль');
  } else {
    const millions = Math.floor(wholePart / 1000000);
    const thousands = Math.floor((wholePart % 1000000) / 1000);
    const remainder = wholePart % 1000;

    if (millions > 0) {
      result.push(convertLessThanOneThousand(millions));
      result.push(getMillionWord(millions));
    }

    if (thousands > 0) {
      result.push(convertLessThanOneThousand(thousands, true));
      result.push(getThousandWord(thousands));
    }

    if (remainder > 0 || (millions === 0 && thousands === 0)) {
      result.push(convertLessThanOneThousand(remainder));
    }
  }

  let resultStr = result.filter(x => x).join(' ');
  resultStr = resultStr.charAt(0).toUpperCase() + resultStr.slice(1);

  return resultStr;
}
