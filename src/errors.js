// Typed provider error carrying an i18n code + params. The UI layer looks up
// the localized message from the code; providers stay locale-agnostic.

export class ProviderError extends Error {
  constructor({ code, providerId, params = {}, fallback }) {
    super(fallback ?? code);
    this.name = "ProviderError";
    this.code = code;
    this.providerId = providerId;
    this.params = params;
  }
}
