# frappe-react-sdk
React hooks library for a [Frappe Framework](https://frappeframework.com) backend.

<br />
<p align="center">
  <a href="https://github.com/nikkothari22/frappe-react-sdk"><img src="https://img.shields.io/maintenance/yes/2022?style=flat-square" /></a>
  <a href="https://github.com/nikkothari22/frappe-react-sdk"><img src="https://img.shields.io/github/license/nikkothari22/frappe-react-sdk?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/frappe-react-sdk"><img src="https://img.shields.io/npm/v/frappe-react-sdk?style=flat-square" /></a>
    <a href="https://www.npmjs.com/package/frappe-react-sdk"><img src="https://img.shields.io/npm/dw/frappe-react-sdk?style=flat-square" /></a>
</p>


## Features

The library currently supports the following features:

- 🔐 Authentication - login with username and password, logout and maintain user state
- 🗄 Database - Hooks to get document, get list of documents, get count, create, update and delete documents
- 📄 File upload - Hook to upload a file to the Frappe filesystem. Maintains loading, progress and error states. 
- 🤙🏻 API calls - Hooks to make API calls to your whitelisted backend functions and maintain state
- 🔍 Search - Hook to search documents in your database (with debouncing ✨)

We plan to add the following features in the future:

- 🗝 Authentication with OAuth clients
- Support for other common functions like `get_last_doc`, `exists` in the database.
- Realtime event listeners using Socket.io

The library uses [frappe-js-sdk](https://github.com/nikkothari22/frappe-js-sdk) and [SWR](https://swr.vercel.app) under the hood to make API calls to your Frappe backend.

### SWR
SWR uses a cache invalidation strategy and also updates the data constantly and automatically (in the background). This allows the UI to always be fast and reactive. 
The hooks in the library use the default configuration for useSWR but you will be able to overwrite the configuration of useSWR. Please refer to the [useSWR API Options](https://swr.vercel.app/docs/options)

### Looking for a Frappe frontend library for other Javascript frameworks?

You can use [frappe-js-sdk](https://github.com/nikkothari22/frappe-js-sdk) to interface your frontend web app with Frappe.

## Maintainers

| Maintainer | GitHub                                    | Social                                        |
| ---------- | ----------------------------------------- | --------------------------------------------- |
| Nikhil Kothari | [nikkothari22](https://github.com/nikkothari22) | [@nik_kothari22](https://twitter.com/nik_kothari22) |
| Janhvi Patil | [janhvipatil](https://github.com/janhvipatil) | [@janhvipatil_](https://twitter.com/janhvipatil_) |

## Installation

```bash
npm install frappe-react-sdk
```

or

```bash
yarn add frappe-react-sdk
```

**Note** - All examples below are in Typescript. If you want to use it with Javascript, just ignore the type generics `<T>` in the examples blow.

## Initialising the library

To get started, initialise the library by wrapping your App with the `FrappeProvider`. 
You can optionally provide the URL of your Frappe server if the web app is not hosted on the same URL. 

In `App.tsx` or `App.jsx`:

```jsx
import { FrappeProvider } from "frappe-react-sdk";

function App() {
    /** The URL is an optional parameter. Only use it if the Frappe server is hosted on a separate URL **/
  return (
    <FrappeProvider url='https://my-frappe-server.frappe.cloud'>
    {/** Your other app components **/}
    </FrappeProvider>
  )

```

## Authentication - `useFrappeAuth()`

The `useFrappeAuth` hook allows you to maintain the state of the current user, as well as login and logout the current user.
The hook uses `useSWR` under the hood to make the `get_current_user` API call - you can also pass in parameters to configure the behaviour of the useSWR hook. 

```jsx
export const MyAuthComponent = () => {

    const { currentUser, isValidating, login, logout, error, updateCurrentUser } = useFrappeAuth();

    if (!currentUser && !error) return <div>loading...</div>

  // render user
    return <div>
        {currentUser}
        <Button onClick={() => login("administrator", "admin")}>Login</Button>
        <Button onClick={logout}>Logout</Button>
        <Button onClick={updateCurrentUser}>Fetch current user</Button>

    </div>
}
```

The hook will throw an error if the API call to `frappe.auth.get_logged_user` fails (network issue etc) or if the user is logged out (403 Forbidden). Handle errors accordingly and route the user to your login page if the error is because the user is not logged in.


## Database

#### Fetch a document

The `useFrappeGetDoc` hook can be used to fetch a document from the database. The hook uses `useSWR` under the hood and it's configuration can be passed to it

```tsx
export const MyDocumentData = () => {
    const { data, error, isValidating, mutate } = useFrappeGetDoc<T>("User", "Administrator", {
        /** SWR Configuration Options - Optional **/
    });

    if (isValidating) {
        return <>Loading</>
    }
    if (error) {
        return <>{JSON.stringify(error)}</>
    }
    if (data) {
        return <p>
            {JSON.stringify(data)}
            <Button onClick={() => mutate()}>Reload</Button>
        </p>
    }
    return null
}
```

#### Fetch list of documents

The `useFrappeGetDocList` hook can be used to fetch a list of documents from the database.

Parameters:

1. DocType name - e.g. "User", "Project"
2. Arguments - optional parameter (object) to sort, filter, paginate and select the fields that you want to fetch.
3. SWRConfiguration - optional

```tsx
export const MyDocumentList = () => {
    const { data, error, isValidating, mutate } = useFrappeGetDocList<T>("DocType", {
        /** Fields to be fetched - Optional */
        fields: ["name", "creation"],
        /** Filters to be applied - SQL AND operation */
        filters: [["creation", ">", "2021-10-09"]],
        /** Filters to be applied - SQL OR operation */
        orFilters: [],
        /** Fetch from nth document in filtered and sorted list. Used for pagination  */
        limit_start: 5,
        /** Number of documents to be fetched. Default is 20  */
        limit: 10,
        /** Sort results by field and order  */
        orderBy: {
            field: "creation",
            order: 'desc'
        },
        /** Fetch documents as a dictionary */
        asDict: false
    },
    {
        /** SWR Configuration Options - Optional **/
    });

    if (isValidating) {
        return <>Loading</>
    }
    if (error) {
        return <>{JSON.stringify(error)}</>
    }
    if (data) {
        return <p>
            {JSON.stringify(data)}
            <Button onClick={() => mutate()}>Reload</Button>
        </p>
    }
    return null
}
```
Type declarations are available for the second argument and will be shown to you in your code editor.

<details><summary>Simpler example without parameters</summary><p>

```tsx
export const MyDocumentList = () => {
    const { data, error, isValidating, mutate } = useFrappeGetDocList<User>("User");

    if (isValidating) {
        return <>Loading</>
    }
    if (error) {
        return <>{JSON.stringify(error)}</>
    }
    if (data) {
        return <p>
            {JSON.stringify(data)}
            <Button onClick={() => mutate()}>Reload</Button>
        </p>
    }
    return null
}
```

</p></details>


#### Fetch number of documents with filters

```tsx
export const DBTest = () => {
    const { data, error, isValidating, mutate } = useFrappeGetDocCount("User", [["enabled", "=", true]]);

    if (isValidating) {
        return <>Loading</>
    }
    if (error) {
        return <>{JSON.stringify(error)}</>
    }
    if (data) {
        return <p>
            {JSON.stringify(data)}
            <Button onClick={() => mutate()}>Reload</Button>
        </p>
    }
    return null
}
```

#### Create a document
To create a new document, pass the name of the DocType and the fields to `createDoc`.
```js
db.createDoc("My Custom DocType", {
        "name": "Test",
        "test_field": "This is a test field"
    })
    .then(doc => console.log(doc))
    .catch(error => console.error(error))
```


#### Update a document
To update an existing document, pass the name of the DocType, name of the document and the fields to be updated to `updateDoc`.
```js
db.updateDoc("My Custom DocType", "Test", {
        "test_field": "This is an updated test field."
    })
    .then(doc => console.log(doc))
    .catch(error => console.error(error))
```

#### Delete a document
To create a new document, pass the name of the DocType and the name of the document to be deleted to `deleteDoc`.
```js
db.deleteDoc("My Custom DocType", "Test")
    .then(response => console.log(response.message)) // Message will be "ok"
    .catch(error => console.error(error))
```

## Usage with Typescript
The library supports Typescript out of the box. 
For example, to enforce type on the `updateDoc` method:

```ts
interface TestDoc {
    test_field: string
}
db.updateDoc<TestDoc>("My Custom DocType", "Test", {
        "test_field": "This is an updated test field."
    })
```

The library also has an inbuilt type `FrappeDoc` which adds the following fields to your type declarations when you use it with the database methods:

```ts
export type FrappeDoc<T> = T & {
  /** User who created the document */
  owner: string;
  /** Date and time when the document was created - ISO format */
  creation: string;
  /** Date and time when the document was last modified - ISO format */
  modified: string;
  /** User who last modified the document */
  modified_by: string;
  idx: number;
  /** 0 - Saved, 1 - Submitted, 2 - Cancelled */
  docstatus: 0 | 1 | 2;
  parent?: any;
  parentfield?: any;
  parenttype?: any;
  /** The primary key of the DocType table */
  name: string;
};
```

All document responses are returned as an intersection of `FrappeDoc` and the specified type.

## API Calls

#### Initialise the call library

```ts
const call = frappe.call()
```

Make sure all endpoints are whitelisted (`@frappe.whitelist()`) in your backend
#### GET request

Make a GET request to your endpoint with parameters.

```js
const searchParams = {
    doctype: "Currency",
    txt: "IN"
}
call.get('frappe.desk.search_link', searchParams)
    .then(result => console.log(result))
    .catch(error => console.error(error))
```
#### POST request

Make a POST request to your endpoint with parameters.

```js
const updatedFields = {
    "doctype": "User",
    "name": "Administrator",
    "fieldname": "interest",
    "value": "Frappe Framework, ERPNext"
}
call.post('frappe.client.set_value', updatedFields)
    .then(result => console.log(result))
    .catch(error => console.error(error))
```

#### PUT request

Make a PUT request to your endpoint with parameters.

```js
const updatedFields = {
    "doctype": "User",
    "name": "Administrator",
    "fieldname": "interest",
    "value": "Frappe Framework, ERPNext"
}
call.put('frappe.client.set_value', updatedFields)
    .then(result => console.log(result))
    .catch(error => console.error(error))
```

#### DELETE request

Make a DELETE request to your endpoint with parameters.

```js
const documentToBeDeleted = {
    "doctype": "Tag",
    "name": "Random Tag",
}
call.put('frappe.client.delete', documentToBeDeleted)
    .then(result => console.log(result))
    .catch(error => console.error(error))
```

## File Uploads

#### Initialise the file library

```ts
const file = frappe.file()
```

#### Upload a file with on progress callback

```js
const myFile; //Your File object

const fileArgs = {
  /** If the file access is private then set to TRUE (optional) */
  "isPrivate": true,
  /** Folder the file exists in (optional) */
  "folder": "Home",
  /** File URL (optional) */
  "file_url": "",
  /** Doctype associated with the file (optional) */
  "doctype": "User",
  /** Docname associated with the file (mandatory if doctype is present) */
  "docname": "Administrator"
}

file.uploadFile(
            myFile, 
            fileArgs, 
            /** Progress Indicator callback function **/
            (completedBytes, totalBytes) => console.log(Math.round((c / t) * 100), " completed")
        )
        .then(() => console.log("File Upload complete"))
        .catch(e => console.error(e))
```

## License

See [LICENSE](./LICENSE).