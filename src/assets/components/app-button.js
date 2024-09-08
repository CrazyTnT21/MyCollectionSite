import {applyStyleSheet, attach_delegates} from "./defaults.js";

export class AppButton extends HTMLElement
{
  static formAssociated = true;
  static observedAttributes = ["type"];

  #internals;

  attributeChangedCallback(name, value, oldValue)
  {
    if (name === "type")
      this.innerType = value;
  }

  get type()
  {
    return this.getAttribute("type");
  }

  set type(value)
  {
    if (!value)
      this.removeAttribute("type");
    else
      this.setAttribute("type", value);
    this.innerType = value;
  }

  set innerType(value)
  {
    const button = this.shadowRoot.querySelector("button");
    if (!value)
      button.removeAttribute("type");
    else
      button.setAttribute("type", value);
  }

  get value()
  {
    return this.getAttribute("data-value");
  }

  set value(value)
  {
    this.setAttribute("data-value", value);
    this.shadowRoot.querySelector("button").innerText = this.value;
  }

  connectedCallback()
  {
    const button = this.shadowRoot.querySelector("button");

    if (this.value)
      button.innerText = this.value;
    else
      button.innerHTML = this.innerHTML;
    this.innerHTML = "";

    if (this.type)
      button.type = this.type;

    button.addEventListener("click", e =>
    {
      if (e.target.type === "submit" && this.#internals.form)
      {
        if (this.#internals.form.reportValidity())
          this.#internals.form.requestSubmit();
      }
    });
  }

  constructor()
  {
    super();
    this.#internals = this.attachInternals();
    this.#internals.ariaRole = "button";
    this.attach();
    this.render();
    this.applyStyleSheet();
  }

  attach = attach_delegates;
  applyStyleSheet = applyStyleSheet;

  render()
  {
    //language=HTML
    this.shadowRoot.innerHTML = `
        <button part="button"></button>
    `;
  }

  styleCSS()
  {
    //language=CSS
    return `
        button {
            display: flex;
            flex: 1 1 100%;
            padding: 10px;
            justify-content: center;
            border: 0;
            background-color: #d6d6d6;
        }

        button:hover, button:focus {
            background-color: #c1bfbf;
        }

        button:active {
            background-color: #c5c5c5;
        }
    `;
  }
}

customElements.define("app-button", AppButton);
