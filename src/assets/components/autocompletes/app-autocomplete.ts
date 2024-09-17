import {AppInput} from "../inputs/app-input.js";

export class AppAutocomplete<T = { id: number, value: any, label?: string }> extends AppInput
{
  private itemsGenerator: AsyncGenerator<T[], T[], T[]>;
  private cachedSearch: Map<string, T[]> = new Map();
  private internalItems: T[] = [];
  private internalItem: T | undefined | null;
  private selectedItems: T[] = [];

  constructor()
  {
    super()
    this.itemsGenerator = this.loadItems();
  }

  #search: T[] = [];

  override get value()
  {
    return this.internalItem;
  }

  override set value(value: T | undefined | null)
  {
    this.internalItem = value;
    if (value == null)
    {
      super.value = null;
      return;
    }
    super.value = this.itemLabel(value) ?? this.itemValue(value);
  }

  findValue(value: string)
  {
    return this.findSameValue(value, this.items);
  }

  get items(): T[]
  {
    return this.internalItems;
  }

  set items(items: T[])
  {
    this.internalItems = items;
    this.createOptions(this.internalItems);
  }

  addItem(item: T)
  {
    this.items.push(item);
    this.#addOptions([item]);
  }

  removeItem(item: T)
  {
    const index = this.items.findIndex(x => this.itemId(x) === this.itemId(item));
    this.items.splice(index, 1);
  }

  findItem(item: T): T | undefined
  {
    const id = this.itemId(item);
    return this.items.find(x => this.itemId(x) === id);
  }

  get selected(): T[]
  {
    return this.selectedItems;
  }

  set selected(items: T[])
  {
    this.selectedItems = items;

    const selected: HTMLUListElement = this.shadowRoot!.querySelector("#selected")!;
    selected.innerHTML = "";
    this.pushSelected(selected, items);
  }

  addSelected(value: T)
  {
    const selected: HTMLUListElement = this.shadowRoot!.querySelector("#selected")!;
    this.pushSelected(selected, [value]);
    this.shadowRoot!.dispatchEvent(new CustomEvent("selectedAdded", {composed: true, detail: value}));
  }

  removeSelected(item: T)
  {
    const id = this.itemId(item);

    const index = this.selectedItems.findIndex(x => this.itemId(x) === id);
    this.selectedItems.splice(index, 1);
    const selected = this.shadowRoot!.querySelector("#selected")!;
    const children = selected.children;
    for (let i = children.length - 1; i >= 0; i--)
    {
      let item = children[i]!;
      const child = <HTMLDataElement>item.firstElementChild;
      if (Number(child.value) != id)
      {
        continue;
      }
      selected.removeChild(item);
      if (i < selected.children.length)
      {
        const button = <HTMLButtonElement>child.firstElementChild;
        button.focus();
      }
      else if (i > 0)
      {
        const previousData = <HTMLDataElement>children[i - 1]!.firstElementChild;
        const button = <HTMLButtonElement>previousData.firstElementChild;
        button.focus();
      }
      return;
    }
    console.error(`Item with the id '${id}' could not be removed. Item not found`);
  }

  private pushSelected(selected: HTMLUListElement, items: T[])
  {
    this.selectedItems.push(...items);
    for (const item of items)
    {
      const li = document.createElement("li");
      const data = document.createElement("data");
      li.append(data);
      data.value = this.itemId(item).toString();
      selected.append(li);
      const button = document.createElement("button");
      button.part.add("selected-button");
      data.append(button);

      button.innerText = this.itemLabel(item) ?? this.itemValue(item);
      button.addEventListener("click", async () =>
      {
        this.removeSelected(item);
        const input = this.shadowRoot!.querySelector("input")!;
        await this.search(input.value);
        this.shadowRoot!.dispatchEvent(new CustomEvent("selectedRemoved", {composed: true, detail: item}));
      });
    }
  }

  findSelected(item: T): T | undefined
  {
    const id = this.itemId(item);
    return this.selected.find(x => this.itemId(x) === id);
  }


  findSelectedValue(value: string)
  {
    return this.findSameValue(value, this.selected);
  }

  findSearch(item: T)
  {
    const id = this.itemId(item);
    return this.#search.find(x => this.itemId(x) === id);
  }

  findSearchValue(value: string)
  {
    return this.findSameValue(value, this.#search);
  }

  private findSameValue(value: string, items: T[])
  {
    const trimAndLowercase = (x: any) => x.toString().trim().toLowerCase();
    value = trimAndLowercase(value);
    return items.find(x =>
    {
      if (trimAndLowercase(this.itemValue(x)) === value)
        return true;
      const label = this.itemLabel(x);
      if (!label)
        return false;

      return trimAndLowercase(label) === value;
    });
  }

  override async onInputChange(event: Event)
  {
    const input = <HTMLInputElement>event.target;
    await super.onInputChange(event);
    await this.valueChange(input);
  }

  override async onValueSet(event: Event)
  {
    const input = this.shadowRoot!.querySelector("input")!;
    await this.search(input.value);
    await super.onValueSet(event);
    await this.valueChange(input);
  }

  async valueChange(input: HTMLInputElement)
  {
    if (!await this.valid())
      return;

    const value = input.value;
    if (!value)
    {
      this.shadowRoot!.dispatchEvent(new CustomEvent("valueChange", {composed: true, detail: null}));
      this.internalItem = null;
      return;
    }
    const item = this.findValue(value) ?? this.findSearchValue(value);
    this.internalItem = item;

    if (this.isMulti() && item)
    {
      if (!this.findSelected(item))
        this.addSelected(item);
      input.value = "";
      await this.search("");
    }

    this.shadowRoot!.dispatchEvent(new CustomEvent("valueChange", {composed: true, detail: item}));
  }

  async onInputInput(event: InputEvent)
  {
    if (event.inputType !== "insertReplacementText")
      await this.search((<HTMLInputElement>event.target).value);
  }

  async onInputFocus(event: FocusEvent)
  {
    await this.firstOpen();
  }

  override async connectedCallback()
  {
    await super.connectedCallback();
    const input = this.shadowRoot!.querySelector("input")!;
    const value = this.dataset["value"];
    if (value != undefined)
      input.value = value;

    input.addEventListener("input", (e) => this.onInputInput(<InputEvent>e));
    triggerOnce(input, "focus", (e) => this.onInputFocus(<FocusEvent>e));
  }

  override render()
  {
    //language=HTML
    this.shadowRoot!.innerHTML = `
      <label part="label" for="input"></label>
      <input part="input" id="input" list="items"/>
      <datalist part="datalist" id="items"></datalist>
      <ul part="selected" id="selected"></ul>
    `;
  }

  createOptions(items: T[])
  {
    const datalist: HTMLDataListElement = this.shadowRoot!.querySelector("#items")!;

    datalist.innerHTML = "";

    this.#pushOptions(datalist, items);
  }

  #addOptions(items: T[])
  {
    const datalist: HTMLDataListElement = this.shadowRoot!.querySelector("#items")!;
    this.#pushOptions(datalist, items);
  }

  #pushOptions(datalist: HTMLDataListElement, items: T[])
  {
    for (const item of items)
    {
      const data = document.createElement("data");
      data.value = this.itemId(item).toString();
      const option = document.createElement("option");
      data.append(option);
      option.innerText = this.itemLabel(item) ?? this.itemValue(item);
      option.value = this.itemValue(item);
      datalist.append(data);
    }
  }

  override async setValidity(input: HTMLInputElement)
  {
    await super.setValidity(input);
    if (!input.value)
      return;

    const value = input.value.toLowerCase().trim();

    if (this.isMulti())
    {
      const found = this.findSelectedValue(value);
      if (found)
      {
        this.errors.set("customError", () => `Item '${value}' has already been selected`);
        return;
      }
    }

    if (!this.findValue(value) && !this.findSearchValue(value))
      this.errors.set("customError", () => `Item '${value}' was not found`);
  }

  isMulti()
  {
    return this.dataset["multi"] === "";
  }

  async firstOpen()
  {
    this.items.push(...(await this.itemsGenerator.next()).value);
    this.createOptions(this.items.filter((x) => !this.findSelected(x)));
  }

  async search(value: string)
  {
    if (value === "")
    {
      this.createOptions(this.items.filter((x) => !this.findSelected(x)));
      return;
    }
    if (this.cachedSearch.has(value))
    {
      this.createOptions(this.cachedSearch.get(value)!.filter((x: T) => !this.findSelected(x)));
      return;
    }

    const search = (await this.searchItems(value).next()).value;
    this.#search = search;
    this.cachedSearch.set(value, search);
    this.createOptions(search.filter((x) => !this.findSelected(x)));
  }

  async* loadItems(): AsyncGenerator<T[]>
  {
    return [...this.children].map(x =>
    {
      const element = <HTMLOptionElement>x;
      return {id: Number(element.dataset["id"]), value: element.value ?? element.innerText, label: element.label}
    });
  }

  async* searchItems(value: string): AsyncGenerator<T[], T[], T[]>
  {
    return this.items;
  }

  override styleCSS(): string
  {
    //language=CSS
    return super.styleCSS() + `
      ul {
        margin: 0;
        padding: 0;
      }

      li {
        list-style: none;
      }

      #selected {
        display: flex;
        flex-wrap: wrap;
        padding-top: 5px;
      }

      button {
        font-size: .75em;
        border-radius: 10px;
        border: gray 1px solid;
      }

      button::after {
        content: " x"
      }
    `;
  }

  itemLabel(item: T): string
  {
    return (<any>item)["label"];
  }

  itemValue(item: T): any
  {
    return (<any>item)["value"];
  }

  itemId(item: T): number
  {
    return (<any>item)["id"];
  }
}

customElements.define("app-autocomplete", AppAutocomplete);

function triggerOnce(element: HTMLElement, type: string, listener: (e: Event) => {})
{
  const remove = (event: Event) =>
  {
    element.removeEventListener(type, remove);
    listener(event);
  };
  element.addEventListener(type, remove);
}