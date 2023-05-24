# frappe-react-sdk

React hooks library for a [Frappe Framework](https://frappeframework.com) backend.

<br />
<p align="center">
  <a href="https://github.com/nikkothari22/frappe-react-sdk"><img src="https://img.shields.io/maintenance/yes/2023?style=flat-square" /></a>
  <a href="https://github.com/nikkothari22/frappe-react-sdk"><img src="https://img.shields.io/github/license/nikkothari22/frappe-react-sdk?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/frappe-react-sdk"><img src="https://img.shields.io/npm/v/frappe-react-sdk?style=flat-square" /></a>
    <a href="https://www.npmjs.com/package/frappe-react-sdk"><img src="https://img.shields.io/npm/dw/frappe-react-sdk?style=flat-square" /></a>
</p>

## Features

The library currently supports the following features:

- 🔐 Authentication - login with username and password (cookie based) + token based authentication, logout and maintain user state
- 🗄 Database - Hooks to get document, get list of documents, get count, create, update and delete documents
- 📄 File upload - Hook to upload a file to the Frappe filesystem. Maintains loading, progress and error states.
- 🤙🏻 API calls - Hooks to make API calls to your whitelisted backend functions and maintain state
- 🔍 Search - Hook to search documents in your database (with debouncing ✨)

We plan to add the following features in the future:

- Support for other common functions like `exists` in the database.

The library uses [frappe-js-sdk](https://github.com/The-Commit-Company/frappe-js-sdk) and [SWR](https://swr.vercel.app) under the hood to make API calls to your Frappe backend.

<br/>

## SWR

SWR uses a cache invalidation strategy and also updates the data constantly and automatically (in the background). This allows the UI to always be fast and reactive.
The hooks in the library use the default configuration for useSWR but you will be able to overwrite the configuration of useSWR. Please refer to the [useSWR API Options](https://swr.vercel.app/docs/options)

<br/>

## Looking for a Frappe frontend library for other Javascript frameworks?

You can use [frappe-js-sdk](https://github.com/nikkothari22/frappe-js-sdk) to interface your frontend web app with Frappe.

<br/>

## Maintainers

| Maintainer     | GitHub                                          | Social                                                       |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Nikhil Kothari | [nikkothari22](https://github.com/nikkothari22) | [@nik_kothari22](https://twitter.com/nik_kothari22)          |
| Janhvi Patil   | [janhvipatil](https://github.com/janhvipatil)   | [@janhvipatil\_](https://twitter.com/janhvipatil_)           |
| Sumit Jain     | [sumitjain236](https://github.com/sumitjain236) | [LinkedIn](https://www.linkedin.com/in/sumit-jain-66bb5719a) |

<br/>

## Installation

```bash
npm install frappe-react-sdk
```

or

```bash
yarn add frappe-react-sdk
```

**Note** - All examples below are in Typescript. If you want to use it with Javascript, just ignore the type generics like `<T>` in the examples below.

<br/>

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

In case you want to use the library with token based authentication (OAuth bearer tokens or API key/secret pairs), you can initialise the library like this:

```jsx
import { FrappeProvider } from 'frappe-react-sdk';

function App() {

  /** The URL is an optional parameter. Only use it if the Frappe server is hosted on a separate URL **/
  return (
    <FrappeProvider url='https://my-frappe-server.frappe.cloud' tokenParams={
        useToken: true,
        // Pass a custom function that returns the token as a string - this could be fetched from LocalStorage or auth providers like Firebase, Auth0 etc.
        token: getTokenFromLocalStorage(),
        // This can be "Bearer" or "token"
        type: "Bearer"
    } >
      {/** Your other app components **/}
    </FrappeProvider>
  );
}
```

<br/>

## Authentication

The `useFrappeAuth` hook allows you to maintain the state of the current user, as well as login and logout the current user.

The hook uses `useSWR` under the hood to make the `get_current_user` API call - you can also pass in parameters to configure the behaviour of the useSWR hook.

```jsx
export const MyAuthComponent = () => {
  const {
    currentUser,
    isValidating,
    isLoading,
    login,
    logout,
    error,
    updateCurrentUser,
    getUserCookie,
  } = useFrappeAuth();

  if (isLoading) return <div>loading...</div>;

  // render user
  return (
    <div>
      {currentUser}
      <button onClick={() => login('administrator', 'admin')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={updateCurrentUser}>Fetch current user</button>
    </div>
  );
};
```

The hook will not make an API call if no cookie is found. If there is a cookie, it will call the `frappe.auth.get_logged_user` method.
The hook will throw an error if the API call to `frappe.auth.get_logged_user` fails (network issue etc) or if the user is logged out (403 Forbidden). Handle errors accordingly and route the user to your login page if the error is because the user is not logged in.

The `getUserCookie` method can be used to reset the auth state if you encounter an authorization error in any other API call. This will then reset the `currentUser` to null.

<br/>

## Database

<br/>

### Fetch a document

The `useFrappeGetDoc` hook can be used to fetch a document from the database. The hook uses `useSWR` under the hood and it's configuration can be passed to it.

Parameters:

| No. | Variable  | type               | Required | Description               |
| --- | --------- | ------------------ | -------- | ------------------------- |
| 1.  | `doctype` | `string`           | ✅       | Name of the doctype       |
| 2.  | `docname` | `string`           | ✅       | Name of the document      |
| 3.  | `options` | `SWRConfiguration` | -        | SWR Configuration Options |

```tsx
export const MyDocumentData = () => {
  const { data, error, isValidating, mutate } = useFrappeGetDoc<T>(
    'User',
    'Administrator',
    {
      /** SWR Configuration Options - Optional **/
    }
  );

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {JSON.stringify(data)}
        <button onClick={() => mutate()}>Reload</button>
      </p>
    );
  }
  return null;
};
```

<hr/>
<br/>

### Fetch list of documents

The `useFrappeGetDocList` hook can be used to fetch a list of documents from the database.

Parameters:

| No. | Variable  | type               | Required | Description                                                                                         |
| --- | --------- | ------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| 1.  | `doctype` | `string`           | ✅       | Name of the doctype                                                                                 |
| 2.  | `args`    | `GetDocListArgs`   | -        | optional parameter (object) to sort, filter, paginate and select the fields that you want to fetch. |
| 3.  | `options` | `SWRConfiguration` | -        | SWR Configuration Options                                                                           |

```tsx
export const MyDocumentList = () => {
  const { data, error, isValidating, mutate } = useFrappeGetDocList<T>(
    'DocType',
    {
      /** Fields to be fetched - Optional */
      fields: ['name', 'creation'],
      /** Filters to be applied - SQL AND operation */
      filters: [['creation', '>', '2021-10-09']],
      /** Filters to be applied - SQL OR operation */
      orFilters: [],
      /** Fetch from nth document in filtered and sorted list. Used for pagination  */
      limit_start: 5,
      /** Number of documents to be fetched. Default is 20  */
      limit: 10,
      /** Sort results by field and order  */
      orderBy: {
        field: 'creation',
        order: 'desc',
      },
      /** Fetch documents as a dictionary */
      asDict: false,
    },
    {
      /** SWR Configuration Options - Optional **/
    }
  );

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {JSON.stringify(data)}
        <button onClick={() => mutate()}>Reload</button>
      </p>
    );
  }
  return null;
};
```

Type declarations are available for the second argument and will be shown to you in your code editor.
<br/>
<br/>

#### Some other simpler examples (click to expand):

<br/>

<details><summary>Fetch 20 items without optional parameters</summary><p>

In this case, only the `name` attribute will be fetched.

```tsx
export const MyDocumentList = () => {
  const { data, error, isValidating } = useFrappeGetDocList<string>('User');

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <ul>
        {data.map((username) => (
          <li>{username}</li>
        ))}
      </ul>
    );
  }
  return null;
};
```

</p></details>

<details><summary>Fetch usernames and emails with pagination</summary><p>

```tsx
type UserItem = {
    name: string,
    email: string
}
export const MyDocumentList = () => {
    const [pageIndex, setPageIndex] = useState(0)
    const { data, error, isValidating } = useFrappeGetDocList<UserItem>("User" , {
        fields: ["name", "email"],
        limit_start: pageIndex,
        /** Number of documents to be fetched. Default is 20  */
        limit: 10,
        /** Sort results by field and order  */
        orderBy: {
            field: "creation",
            order: 'desc'
        }
    });

    if (isValidating) {
        return <>Loading</>
    }
    if (error) {
        return <>{JSON.stringify(error)}</>
    }
    if (data) {
        return <div>
            <ul>
            {
                data.map({name, email} => <li>{name} - {email}</li>)
            }
            </ul>
            <button onClick={() => setPageIndex(pageIndex + 10)}>Next page</button>
        </div>
    }
    return null
}
```

</p></details>

<br/>
<hr/>
<br/>

### Fetch number of documents with filters

<br/>

Parameters:

| No. | Variable  | type               | Required | Description                                                    |
| --- | --------- | ------------------ | -------- | -------------------------------------------------------------- |
| 1.  | `doctype` | `string`           | ✅       | Name of the doctype                                            |
| 2.  | `filters` | `Filter[]`         | -        | optional parameter to filter the result                        |
| 3.  | `cache`   | `boolean`          | -        | Whether to cache the value on the server - default: `false`    |
| 3.  | `debug`   | `boolean`          | -        | Whether to log debug messages on the server - default: `false` |
| 3.  | `config`  | `SWRConfiguration` | -        | SWR Configuration Options                                      |

```tsx
export const DocumentCount = () => {
  const { data, error, isValidating, mutate } = useFrappeGetDocCount(
    'User',
    /** Filters **/
    [['enabled', '=', true]],
    /** Cache the result on server **/
    false,
    /** Print debug logs on server **/
    false,
    {
      /** SWR Configuration Options - Optional **/
    }
  );

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {data} enabled users
        <Button onClick={() => mutate()}>Reload</Button>
      </p>
    );
  }
  return null;
};
```

#### Some other simpler examples (click to expand):

<br/>
<details><summary>Fetch total number of documents</summary><p>

```tsx
export const DocumentCount = () => {
  const { data, error, isValidating } = useFrappeGetDocCount('User');

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return <p>{data} total users</p>;
  }
  return null;
};
```

</p></details>

<details><summary>Fetch number of documents with filters</summary><p>

```tsx
export const DocumentCount = () => {
  const { data, error, isValidating } = useFrappeGetDocCount('User', [
    ['enabled', '=', true],
  ]);

  if (isValidating) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return <p>{data} enabled users</p>;
  }
  return null;
};
```

</p></details>

<br/>
<hr/>
<br/>

### Create a document

To create a new document, pass the name of the DocType and the fields to `createDoc`.

```js
db.createDoc('My Custom DocType', {
  name: 'Test',
  test_field: 'This is a test field',
})
  .then((doc) => console.log(doc))
  .catch((error) => console.error(error));
```

<br/>
<hr/>
<br/>

### Update a document

To update an existing document, pass the name of the DocType, name of the document and the fields to be updated to `updateDoc`.

```js
db.updateDoc('My Custom DocType', 'Test', {
  test_field: 'This is an updated test field.',
})
  .then((doc) => console.log(doc))
  .catch((error) => console.error(error));
```

<br/>
<hr/>
<br/>

### Delete a document

To create a new document, pass the name of the DocType and the name of the document to be deleted to `deleteDoc`.

```js
db.deleteDoc('My Custom DocType', 'Test')
  .then((response) => console.log(response.message)) // Message will be "ok"
  .catch((error) => console.error(error));
```

<br/>

## API Calls

<br/>

### GET request

Make a GET request to your endpoint with parameters.

```js
const searchParams = {
  doctype: 'Currency',
  txt: 'IN',
};
call
  .get('frappe.desk.search_link', searchParams)
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

<br/>
<hr/>
<br/>

### POST request

Make a POST request to your endpoint with parameters.

```js
const updatedFields = {
  doctype: 'User',
  name: 'Administrator',
  fieldname: 'interest',
  value: 'Frappe Framework, ERPNext',
};
call
  .post('frappe.client.set_value', updatedFields)
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

<br/>
<hr/>
<br/>

### PUT request

Make a PUT request to your endpoint with parameters.

```js
const updatedFields = {
  doctype: 'User',
  name: 'Administrator',
  fieldname: 'interest',
  value: 'Frappe Framework, ERPNext',
};
call
  .put('frappe.client.set_value', updatedFields)
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

<br/>
<hr/>
<br/>

### DELETE request

Make a DELETE request to your endpoint with parameters.

```js
const documentToBeDeleted = {
  doctype: 'Tag',
  name: 'Random Tag',
};
call
  .put('frappe.client.delete', documentToBeDeleted)
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
```

<br/>

## File Uploads

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
  "docname": "Administrator",
  /** Field to be linked in the Document **/
  "fieldname" : "image"
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

<br/>

## License

See [LICENSE](./LICENSE).
