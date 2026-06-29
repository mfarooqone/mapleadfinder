export function phoneToWaMeDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWaMeLink(
  businessPhone: string,
  prefilledText = 'Hi',
): string {
  const digits = phoneToWaMeDigits(businessPhone);
  const text = encodeURIComponent(prefilledText.trim() || 'Hi');
  return `https://wa.me/${digits}?text=${text}`;
}
