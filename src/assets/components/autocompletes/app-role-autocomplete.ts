import {AppAutocomplete} from "./app-autocomplete/app-autocomplete.js";
import {API_URL} from "../../../modules.js";
import {Role} from "../../types/role.js";
import createClient from "openapi-fetch";
import {paths} from "mycollection-openapi";

export class AppRoleAutocomplete extends AppAutocomplete<Role>
{
  override async connectedCallback(): Promise<void>
  {
    this.label = this.label || "Role";
    await super.connectedCallback();
  }

  override async* searchItems(value: string): AsyncGenerator<Role[]>
  {
    const client = createClient<paths>({baseUrl: API_URL});
    let page = 0;
    const count = 50;
    let total = 51;
    while (page * count < total)
    {
      const {data, error} = await client.GET("/roles/name/{name}", {
        params: {
          path: {name: value},
          query: {page, count}
        }
      });
      if (data == undefined)
      {
        console.error(error)
        return [];
      }
      page++;
      total = data.total;
      yield data.items;
    }
  }

  override async* loadItems(): AsyncGenerator<Role[]>
  {
    const client = createClient<paths>({baseUrl: API_URL});
    let page = 0;
    const count = 50;
    let total = 51;
    while (page * count < total)
    {
      const {data, error} = await client.GET("/roles", {
        params: {
          query: {page, count}
        }
      });
      if (data == undefined)
      {
        console.error(error)
        return [];
      }
      page++;
      total = data.total;
      yield data.items;
    }
  }

  override itemValue(item: Role): string
  {
    return item.name;
  }

  override itemId(item: Role): number
  {
    return item.id;
  }
}

customElements.define("app-role-autocomplete", AppRoleAutocomplete);
