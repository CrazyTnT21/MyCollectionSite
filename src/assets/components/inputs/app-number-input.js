import {AppInput} from "./app-Input.js";

export class AppNumberInput extends AppInput
{
  constructor()
  {
    super();
    this.shadowRoot.querySelector("input").type = "number";
  }

  styleCSS()
  {
    //language=CSS
    return super.styleCSS() + `
        input[type=number] {
            -moz-appearance: textfield;
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
    `;
  }
}

customElements.define("app-number-input", AppNumberInput);
