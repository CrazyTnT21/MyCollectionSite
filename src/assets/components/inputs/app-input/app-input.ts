import {applyStyleSheet, attach_delegates} from "../../defaults.js";
import {logNoValueError, tooLong, tooShort, valueMissing} from "../validation/validation.js";
import {ApplyStyleSheet} from "../../apply-style-sheet.js";
import {StyleCSS} from "../../style-css.js";
import {handleFieldset} from "../common.js";
import {ValueSetEvent} from "./value-set-event.js";

type attributeKey = keyof typeof AppInput["observedAttributesMap"];

export class AppInput extends HTMLElement implements ApplyStyleSheet, StyleCSS
{
  static readonly formAssociated = true;
  errors: Map<keyof ValidityStateFlags, () => string> = new Map();

  private readonly internals: ElementInternals;
  override shadowRoot: ShadowRoot;

  private static readonly observedAttributesMap = {
    "data-label": AppInput.dataLabelAttr,
    "required": AppInput.requiredAttr,
    "disabled": AppInput.disabledAttr,
    "maxlength": AppInput.maxLengthAttr,
    "minlength": AppInput.minlengthAttr,
    "placeholder": AppInput.placeholderAttr
  }
  static readonly observedAttributes = <[attributeKey]>Object.keys(AppInput.observedAttributesMap);

  async attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): Promise<void>
  {
    if (Object.keys(AppInput.observedAttributesMap).includes(name))
    {
      const callback = AppInput.observedAttributesMap[name as attributeKey]!;
      callback(this, newValue);
    }
    await this.validate();
  }

  //Attributes

  private static dataLabelAttr(element: AppInput, value: string | null | undefined): void
  {
    if (value == null || value.trim() == "")
    {
      logNoValueError("label", element.outerHTML);
      value = ""
    }
    element.shadowRoot.querySelector("label")!.innerText = value;
  }

  private static placeholderAttr(element: AppInput, value: string | null | undefined): void
  {
    element.shadowRoot.querySelector("input")!.placeholder = value ?? "";
  }

  private static disabledAttr(element: AppInput, value: string | null | undefined): void
  {
    const disabled = element.hasDisabledFieldset || value == "";
    const input = element.shadowRoot.querySelector("input")!;
    input.disabled = disabled;
    element.internals.ariaDisabled = disabled ? "" : null;
  }

  private static maxLengthAttr(element: AppInput, value: string | null | undefined): void
  {
    const input = element.shadowRoot.querySelector("input")!;
    if (value == null)
      input.removeAttribute("maxlength");
    else
      input.setAttribute("maxlength", value.toString());
  }

  private static minlengthAttr(element: AppInput, value: string | null | undefined): void
  {
    const input = element.shadowRoot.querySelector("input")!;
    if (value == null)
      input.removeAttribute("minlength");
    else
      input.setAttribute("minlength", value.toString());
  }

  private static requiredAttr(element: AppInput, value: string | null | undefined): void
  {
    element.shadowRoot.querySelector("input")!.required = value == "";
  }

  get label(): string
  {
    return this.dataset["label"] ?? "";
  }

  set label(value: string)
  {
    this.dataset["label"] = value;
  }

  get required(): boolean
  {
    const attribute = this.getAttribute("required");
    return attribute ? attribute == "" : false;
  }

  set required(value: boolean)
  {
    if (value)
      this.setAttribute("required", "")
    else
      this.removeAttribute("required");
  }

  get disabled(): boolean
  {
    return this.getAttribute("disabled") == "" || this.hasDisabledFieldset;
  }

  set disabled(value: boolean)
  {
    if (value)
      this.setAttribute("disabled", "")
    else
      this.removeAttribute("disabled");
  }

  get minLength(): number | null
  {
    const attribute = this.getAttribute("minlength");
    return attribute ? Number(attribute) : null;
  }

  set minLength(value: number | null)
  {
    if (value == null)
      this.removeAttribute("minlength")
    else
      this.setAttribute("minlength", value.toString());
  }

  get maxLength(): number | null
  {
    const attribute = this.getAttribute("maxlength");
    return attribute ? Number(attribute) : null;
  }

  set maxLength(value: number | null)
  {
    if (value == null)
      this.removeAttribute("maxlength")
    else
      this.setAttribute("maxlength", value.toString())
  }

  get value(): any
  {
    return this.shadowRoot.querySelector("input")!.value;
  }

  set value(value: string | null | undefined)
  {
    if (value == null)
      value = "";

    this.shadowRoot.querySelector("input")!.value = value;
    this.dispatchEvent(new ValueSetEvent({detail: value}));
  }

  private internalHasDisabledFieldset: boolean = false;

  get hasDisabledFieldset(): boolean
  {
    return this.internalHasDisabledFieldset;
  }

  set hasDisabledFieldset(value: boolean)
  {
    this.internalHasDisabledFieldset = value;
    AppInput.disabledAttr(this, this.getAttribute("disabled"))
  }

  get placeholder(): string | null | undefined
  {
    return this.getAttribute("placeholder")
  }

  set placeholder(value: string | null | undefined)
  {
    if (value == null)
      this.removeAttribute("placeholder");
    else
      this.setAttribute("placeholder", value);
  }

  async connectedCallback(): Promise<void>
  {
    this.label = this.label || "";
    this.disabled = this.getAttribute("disabled") == "";
    const input = this.shadowRoot.querySelector("input")!;
    input.addEventListener("change", (e) => this.onInputChange(e));
    input.placeholder = this.placeholder ?? "";
    handleFieldset(this);
    await this.setupValidation();
  }

  async onValueSet(event: Event): Promise<void>
  {
    await this.validate();
  }

  async onInputChange(event: Event): Promise<void>
  {
    this.interacted = true;
    await this.validateAndReport();
  }

  constructor()
  {
    super();
    this.internals = this.setupInternals();
    this.shadowRoot = this.attach();
    this.render();
    this.applyStyleSheet();
    this.addEventListener(ValueSetEvent.type, (e) => this.onValueSet(e));
  }

  attach = attach_delegates;
  applyStyleSheet = applyStyleSheet;

  setupInternals(): ElementInternals
  {
    const internals = this.attachInternals();
    internals.role = "textbox";
    return internals;
  }

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
      this.internals.setValidity({[error[0]]: true}, error[1](), input);
      input.setCustomValidity(error[1]());
    }
    this.setCustomError = (): void =>
    {
    };
    if (this.interacted)
    {
      if (!input.checkValidity())
      {
        this.dataset["invalid"] = "";
        input.dataset["invalid"] = ""
      }
      else
      {
        delete this.dataset["invalid"];
        delete input.dataset["invalid"]
      }

    }
  }

  private interacted: boolean = false;

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
    this.setValueMissing(input);
    this.setMinLength(input);
    this.setMaxLength(input);
    this.setCustomError(input);
  }

  async valid(): Promise<boolean>
  {
    const input = this.shadowRoot.querySelector("input")!;
    await this.setValidity(input);
    return this.errors.size == 0;
  }

  setValueMissing(input: HTMLInputElement): void
  {
    if (this.isRequired() && valueMissing(input))
    {
      this.errors.set("valueMissing", () => "No value given");
    }
  }

  isRequired(): boolean
  {
    return this.getAttribute("required") === "";
  }

  setMinLength(input: HTMLInputElement): void
  {
    const min = this.getAttribute("minlength");

    if (tooShort(input, min ? Number(min) : null))
    {
      this.errors.set("tooShort", () => `Input requires at least ${min} characters. Current length: ${input.value.length}`);
    }
  }

  setMaxLength(input: HTMLInputElement): void
  {
    const max = this.getAttribute("maxlength");

    if (tooLong(input, max ? Number(max) : null))
    {
      this.errors.set("tooLong", () => `Input only allows a maximum of ${max} characters. Current length: ${input.value.length}`);
    }
  }

  setCustomError(input: HTMLInputElement): void
  {
  }

  render(): void
  {
    //language=HTML
    this.shadowRoot.innerHTML = `
      <span class="parent container">
        <label part="label" for="input"></label>
        <input class="input control" part="input" id="input"/>
      </span>
    `;
  }

  styleCSS(): string
  {
    //language=CSS
    return `
      .input {
        display: inline-flex;
        border-radius: 5px;
        border-width: 1px;
        border-style: solid;
        border-color: lightgray;
        flex: 1;
      }

      .input:hover {
        border-color: #E6E6E6FF;
        transition: border-color ease 50ms;
      }

      .input[data-invalid] {
        border-color: red;
      }

      label {
        position: absolute;
        /*TODO: Part*/
        color: var(--secondary-text, lightgray);
        transition: transform ease 50ms;
        margin: 6px;
        font-size: 1.10em;
      }

      .parent:has(input:focus) > label,
      .parent:has(input:not(input:placeholder-shown)) > label {
        /*TODO: Part*/
        color: var(--primary-text, black);
        font-size: 0.8em;
        line-height: 0.8em;
        margin: 0 0 0 5px;
        transform: translateY(calc(-60%));
        /*TODO: part*/
        background: linear-gradient(180deg, transparent 0 3px, var(--input-background) 3px 100%);

        transition: transform ease 50ms;
      }

      :host([required]) {
        label::after {
          content: "*";
          color: red;
        }

        input:not(input:focus) ~ label::after {
          /*TODO: Part*/
          color: var(--negative-hover, #ff9191);
        }
      }

      input:not(input:focus)::placeholder {
        color: transparent;
      }

      * {
        font-family: "Fira Sans", sans-serif;
      }

      :host {
        padding: 5px;
        display: inline-flex;
        margin-top: 2px;
        flex: 1;
        box-sizing: border-box;
        max-width: 100%;
        align-self: flex-start;
      }

      .container {
        display: inline-flex;
        flex: 1;
        box-sizing: border-box;
        max-width: 100%;
      }

      .control {
        display: inline-flex;
        padding: 5px;
        min-height: 0;
        min-width: 0;
        flex-wrap: wrap;
        border-radius: 5px;
        font-size: 1.10em;
      }
    `;
  }
}

customElements.define("app-input", AppInput);
