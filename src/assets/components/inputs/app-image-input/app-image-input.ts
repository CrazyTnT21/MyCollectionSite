import {applyStyleSheet, attach_delegates} from "../../defaults.js";
import {ApplyStyleSheet} from "../../apply-style-sheet.js";
import {StyleCSS} from "../../style-css.js";
import {logNoValueError} from "../validation/validation.js";
import {UploadEvent} from "./upload-event.js";

export class AppImageInput extends HTMLElement implements ApplyStyleSheet, StyleCSS
{
  static readonly formAssociated = true;
  static readonly observedAttributes = ["required", "minlength", "maxlength"];
  public errors: Map<keyof ValidityStateFlags, () => string> = new Map();

  async attributeChangedCallback(name: string, oldValue: any, newValue: any): Promise<void>
  {
    await this.validate();
  }

  private internals: ElementInternals;
  override shadowRoot: ShadowRoot;

  get label(): string
  {
    return this.dataset["label"]!;
  }

  set label(value: string)
  {
    this.dataset["label"] = value;
    this.shadowRoot.querySelector("label")!.innerText = value;
    this.shadowRoot.querySelector("img")!.alt = value;
  }

  private innerFiles: { file: File, url: string }[] = [];

  get files(): { file: File, url: string }[]
  {
    return this.innerFiles;
  }

  set files(value)
  {
    this.innerFiles = value;
  }


  get multiple(): boolean
  {
    const value = this.dataset["multiple"];
    return value == ""
  }

  set multiple(value: boolean)
  {
    if (!value)
      delete this.dataset["multiple"];
    else
      this.dataset["multiple"] = "";

    this.shadowRoot.querySelector("input")!.multiple = value;
  }

  get maxFileSize(): number | null
  {
    const value = this.dataset["maxFilesize"];
    return value ? Number(value) : null;
  }

  set maxFileSize(value: number | null)
  {
    if (value == null)
      delete this.dataset["max-filesize"];
    else
      this.dataset["maxFilesize"] = value.toString();
  }

  get minFileSize(): number | null
  {
    const value = this.dataset["minFilesize"];
    return value ? Number(value) : null;
  }

  set minFileSize(value: number | null)
  {
    if (value == null)
      delete this.dataset["minFilesize"];
    else
      this.dataset["minFilesize"] = value.toString();
  }

  disabledValue: boolean = false;
  hasDisabledFieldset: boolean = false;

  get disabled(): boolean
  {
    return this.getAttribute("disabled") == "";
  }

  set disabled(value: boolean)
  {
    this.disabledValue = value;
    value = this.disabledValue || this.hasDisabledFieldset;

    if (value)
      this.setAttribute("disabled", "");
    else
      this.removeAttribute("disabled");
    this.shadowRoot.querySelector("input")!.disabled = value;
  }

  get imageTitle(): string | null | undefined
  {
    return this.dataset["title"];
  }

  set imageTitle(value: string | null | undefined)
  {
    if (value == null)
      delete this.dataset["title"];
    else
      this.dataset["title"] = value;
    this.shadowRoot.querySelector("img")!.title = value ?? "";
  }

  #src: string | undefined;
  get src(): string | undefined
  {
    return this.#src;
  }

  set src(value: string | undefined)
  {
    if (!value)
      throw Error("Src has to be set");
    this.#src = value;
    this.shadowRoot.querySelector("img")!.src = value;
  }

  async connectedCallback(): Promise<void>
  {
    const input = this.shadowRoot.querySelector("input")!;
    input.addEventListener("change", event => this.setImage(<InputEvent>event));

    const image = this.shadowRoot.querySelector("img")!;
    const label = this.dataset["label"] ?? "";
    if (!label)
      logNoValueError("label", this.outerHTML);

    image.alt = label;
    this.multiple = this.dataset["multiple"] == ""
    this.shadowRoot.querySelector("label")!.innerText = label;
    if (this.imageTitle)
      image.title = this.imageTitle;

    image.addEventListener("click", () =>
    {
      if (!this.disabled)
        input.click();
    });
    image.addEventListener("keyup", (e) =>
    {
      if (e.key === "Enter")
        input.click();
    });
    await this.setupValidation();
  }

  private defaultSrc = "/assets/img/Image_Input_Placeholder.svg";

  constructor()
  {
    super();
    this.internals = this.attachInternals();
    this.shadowRoot = this.attach();
    this.render();
    this.applyStyleSheet();
  }

  attach = attach_delegates;
  applyStyleSheet = applyStyleSheet;

  async setupValidation(): Promise<void>
  {
    const input = this.shadowRoot.querySelector("input")!;
    input.addEventListener("change", () => this.validateAndReport());
    await this.validate();
  }

  async validate(): Promise<void>
  {
    const input = this.shadowRoot.querySelector("input")!;
    await this.setValidity(input);
    this.internals.setValidity({});
    input.setCustomValidity("");
    const error = this.errors.entries().next().value;
    if (error)
    {
      const img = this.shadowRoot.querySelector("img")!;
      this.internals.setValidity({[error[0]]: true}, error[1](), img);
    }
    this.setCustomError = (): void =>
    {
    };
  }

  setCustomError(input: HTMLInputElement): void
  {
  }

  async validateAndReport(): Promise<void>
  {
    await this.validate();
    const input = this.shadowRoot.querySelector("input")!;
    const error = this.errors.entries().next().value;
    if (error)
      input.setCustomValidity(error[1]());
    this.internals.reportValidity();
  }

  async setValidity(input: HTMLInputElement): Promise<void>
  {
    this.internals.setFormValue(input.value);
    this.errors = new Map();
    this.setMaxFileSize(input);
    this.setMinFileSize(input);
    this.setValueMissing(input);
    this.setUnsupportedType(input);
    this.setCustomError(input);
  }

  setUnsupportedType(input: HTMLInputElement): void
  {
    if (!unsupportedImageType(input))
      return;

    this.errors.set("customError", () => `Unsupported image type`);
  }

  setMaxFileSize(input: HTMLInputElement): void
  {
    const max = this.maxFileSize;
    if (!fileTooBig(input, max))
      return;

    this.errors.set("customError", () => `Input only allows a maximum of ${max} characters. Current length: ${input.value.length}`);
  }

  setMinFileSize(input: HTMLInputElement): void
  {
    const min = this.minFileSize;

    if (!fileTooSmall(input, min))
      return;

    this.errors.set("customError", () => `Input requires at least ${min} characters. Current length: ${input.value.length}`);
  }

  setValueMissing(input: HTMLInputElement): void
  {
    if (!this.isRequired() || !valueMissing(input))
      return;

    this.errors.set("valueMissing", () => "No value given");
  }

  isRequired(): boolean
  {
    return this.getAttribute("required") === "";
  }

  render(): void
  {
    //TODO: Clear image button
    //language=HTML
    this.shadowRoot.innerHTML = `
      <label for="input"></label>
      <input part="input" id="input" type="file" hidden="hidden" accept=".jpg,.jpeg,.png"/>
      <img alt="" part="img" tabindex=0 src="${this.defaultSrc}">
    `;
  }

  styleCSS(): string
  {
    //language=CSS
    return `
      img {
        border-radius: 5px;
        display: inline-flex;
        max-width: 100%;
        max-height: 100%;
        aspect-ratio: 1 / 1.41421;
        object-fit: contain;
        border: 1px solid lightgray;
        flex: 1;
      }

      label {
        position: absolute;
        color: var(--primary-text, black);
        margin: 0 0 0 5px;
        transform: translateY(calc(-60%));
        background-color: var(--background);

        transition: transform ease 50ms;
      }

      :host {
        padding: 5px;
        margin-top: 2px;
        display: inline-flex;
        flex: 1;
        box-sizing: border-box;
        max-width: 100%;
      }

      :host([required]) {
        label::after {
          content: "*";
          color: red;

          input:not(input:focus) ~ label::after {
            /*TODO: Part*/
            color: var(--negative-hover, #ff9191);
          }
        }
      }

      input:not(input:focus)::placeholder {
        color: transparent;
      }

      input:hover {
        border-color: #E6E6E6FF;
        transition: border-color ease 50ms;
      }

      input:invalid + img {
        border-color: red
      }

      img:hover {
        filter: opacity(50%);
      }


      :host([disabled]) > img {
        filter: brightness(75%);
      }
    `;
  }

  async valid(): Promise<boolean>
  {
    const input = this.shadowRoot.querySelector("input")!;
    await this.setValidity(input);
    return this.errors.size === 0;
  }

  async setImage(event: InputEvent): Promise<void>
  {
    const input = (<HTMLInputElement>event.target);
    const files = [...input.files!].map(x => ({file: x, url: URL.createObjectURL(x)}));

    this.files = [];
    if (!this.multiple)
    {
      const file = files[files.length - 1]!;
      if (!file.file.type.includes("image"))
        this.shadowRoot.querySelector("img")!.src = this.defaultSrc;
      else
        this.shadowRoot.querySelector("img")!.src = file.url!;
      this.#src = file.url;
    }
    if (await this.valid())
    {
      this.shadowRoot.dispatchEvent(new UploadEvent({composed: true, detail: files}));
      this.files = files;
    }
  }
}

customElements.define("app-image-input", AppImageInput);

function unsupportedImageType(input: HTMLInputElement): boolean
{
  for (const file of input.files!)
  {
    if (!file.type.includes("image"))
      return true;
  }
  return false;
}

function fileTooBig(input: HTMLInputElement, max: number | undefined | null): boolean
{
  if (!max)
    return false;

  for (const file of input.files!)
  {
    if (file.size > max * 1024)
      return true;
  }
  return false;
}

function fileTooSmall(input: HTMLInputElement, min: number | undefined | null): boolean
{
  if (!min)
    return false;

  for (const file of input.files!)
  {
    if (file.size < min * 1024)
      return true;
  }
  return false;
}

function valueMissing(input: HTMLInputElement): boolean
{
  return input.files!.length === 0;
}
