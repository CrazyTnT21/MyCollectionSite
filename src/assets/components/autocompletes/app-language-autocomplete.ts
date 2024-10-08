import {AppAutocomplete} from "./app-autocomplete.js";
import {getLanguageCode, Language} from "../../classes/language.js";

type LanguageLabel = { id: number, value: string, label: string };

export class AppLanguageAutocomplete extends AppAutocomplete<LanguageLabel>
{
  override set value(value: LanguageLabel | null | undefined)
  {
    super.value = value;
  }

  override async connectedCallback()
  {
    this.label = this.label ?? "Language";
    await super.connectedCallback();
  }

  #items = [
    {id: 1, ...getLanguageAndCode(Language.EN)},
    {id: 2, ...getLanguageAndCode(Language.DE)},
    {id: 3, ...getLanguageAndCode(Language.ES)},
    {id: 4, ...getLanguageAndCode(Language.JA)},
  ];

  override async* searchItems(): AsyncGenerator<LanguageLabel[]>
  {
    return this.#items;
  }

  override async* loadItems()
  {
    return this.#items;
  }
}

customElements.define("app-language-autocomplete", AppLanguageAutocomplete);

function getLanguageAndCode(language: Language)
{
  return {label: language, value: getLanguageCode(language)}
}
