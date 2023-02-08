import { PropsWithChildren, useMemo } from "react";
import { createContext } from "react";
import { FrappeApp, FrappeAuth, FrappeCall } from "frappe-js-sdk";
import { FrappeDB } from "frappe-js-sdk/lib/db";
import { FrappeFileUpload } from "frappe-js-sdk/lib/file";
import { Error } from 'frappe-js-sdk/lib/frappe_app/types';
import { Filter, FrappeDoc, GetDocListArgs } from 'frappe-js-sdk/lib/db/types'
import { useCallback, useContext, useEffect, useState } from 'react'
import useSWR, { Key, SWRConfiguration, SWRResponse } from 'swr'
import { FileArgs } from 'frappe-js-sdk/lib/file/types';
import { DexieDatabase, indexdb } from "./db";


export type { SWRConfiguration, SWRResponse, Key }

export type { FrappeDoc, GetDocListArgs, Filter, FileArgs, Error as FrappeError }
export interface FrappeConfig {
    /** The URL of your Frappe server */
    url: string;
    app: FrappeApp,
    auth: FrappeAuth,
    db: FrappeDB,
    call: FrappeCall,
    file: FrappeFileUpload,
    indexdb: DexieDatabase
}

export interface lastFetchType {
    _id: string;
    name: string;
    doctype: string;
    lastFetchedOn: Date;
    modified: string;
    count: number;
    data: any;
}
export interface modifiedType {
    modified: string;
}

export interface indexedDBType {
    databaseName: string;
    version: number;
}

export const FrappeContext = createContext<null | FrappeConfig>(null)

type FrappeProviderProps = PropsWithChildren<{ url?: string, indexDB?: indexedDBType }>

/** Frappe Provider component that provides the Frappe context to all child components
 * @param url - [Optional] The URL of your Frappe server
 * @param indexDB - [Optional] The indexedDB configuration object with databaseName and version 
 * @param children - The children components
 * 
 * @example
 * ```tsx
 * const indexDB = {
 *      databaseName:'myDatabase',
 *      version:1
 * }
 * <FrappeProvider url="http://localhost:8000" indexDB = indexDB>
 *     <App />
 * </FrappeProvider>
 * ```
*/
export const FrappeProvider = ({ url = "", indexDB, children }: FrappeProviderProps) => {

    const frappeConfig: FrappeConfig = useMemo(() => {
        //Add your Frappe backend's URL
        const frappe = new FrappeApp(url)

        return {
            url,
            app: frappe,
            auth: frappe.auth(),
            db: frappe.db(),
            call: frappe.call(),
            file: frappe.file(),
            indexdb: new DexieDatabase(indexDB?.databaseName, indexDB?.version)
        }

    }, [url])

    return <FrappeContext.Provider value={frappeConfig}>{children}</FrappeContext.Provider>
}


/**
 * Hook to start listening to user state and provides functions to login/logout
 * 
 * @param options - [Optional] SWRConfiguration options for fetching current logged in user
 * @returns Returns an object with the following properties: currentUser, loading, error, and functions to login, logout and updateCurrentUser
 */
export const useFrappeAuth = (options?: SWRConfiguration): {
    /** The current logged in user. Will be null/undefined if user is not logged in */
    currentUser: string | null | undefined,
    /** Will be true when the hook is fetching (or revalidating) the user state. (Refer to isValidating in useSWR)  */
    isValidating: boolean,
    /** Error object returned from API call */
    error: Error | null | undefined,
    /** Function to login the user with email and password */
    login: (username: string, password: string) => Promise<void>,
    /** Function to log the user out */
    logout: () => Promise<any>,
    /** Function to fetch updated user state */
    updateCurrentUser: () => void
} => {

    const { url, auth, indexdb } = useContext(FrappeContext) as FrappeConfig

    const { data: currentUser, error, isValidating, mutate: updateCurrentUser } = useSWR<string | null, Error>(`${url}/api/method/frappe.auth.get_logged_user`, () => auth.getLoggedInUser(), options)

    const login = useCallback(async (username: string, password: string) => {
        return auth.loginWithUsernamePassword({ username, password }).then((m) => {
            console.log(m)
            updateCurrentUser()
        })
    }, [])

    const deleteDatabase = () => {
        if (indexdb) {
            indexdb.delete()
        }
    }

    const logout = useCallback(async () => {
        return auth.logout().then(() => deleteDatabase).then(() => updateCurrentUser(null))
    }, [])

    return {
        currentUser,
        isValidating,
        error,
        login,
        logout,
        updateCurrentUser
    }
}

/**
 * Hook to fetch a document from the database
 * 
 * 
 * @param doctype - The doctype to fetch
 * @param name - the name of the document to fetch
 * @param options [Optional] SWRConfiguration options for fetching data
 * @returns an object (SWRResponse) with the following properties: data, error, isValidating, and mutate
 * 
 * @typeParam T - The type of the document
 */
export const useFrappeGetDoc = <T,>(doctype: string, name?: string, swrKey?: Key, options?: SWRConfiguration): SWRResponse<FrappeDoc<T>, Error> => {

    const { db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<FrappeDoc<T>, Error>(swrKey === undefined ? db.getRequestURL(doctype, name) : swrKey, () => db.getDoc<T>(doctype, name), options)

    return {
        ...swrResult
    }
}
/**
 * Function that returns a query string for all arguments passed to getDocList function
 * @param args - The arguments to pass to the getDocList method
 * @returns query string to be appended to the url for the API call
 */
export const getDocListQueryString = (args?: GetDocListArgs): string => {

    let queryString = ""

    /** Fields to be fetched */
    if (args?.fields) {
        queryString += "fields=" + JSON.stringify(args?.fields) + '&'
    }

    /** Filters to be applied - SQL AND operation */
    if (args?.filters) {
        queryString += "filters=" + JSON.stringify(args?.filters) + '&'
    }

    /** Filters to be applied - SQL OR operation */
    if (args?.orFilters) {
        queryString += "or_filters=" + JSON.stringify(args?.orFilters) + '&'
    }

    /** Fetch from nth document in filtered and sorted list. Used for pagination  */
    if (args?.limit_start) {
        queryString += "limit_start=" + JSON.stringify(args?.limit_start) + '&'
    }

    /** Number of documents to be fetched. Default is 20  */
    if (args?.limit) {
        queryString += "limit=" + JSON.stringify(args?.limit) + '&'
    }

    /** Sort results by field and order  */
    if (args?.orderBy) {
        const orderByString = `${args.orderBy?.field} ${args.orderBy?.order ?? 'asc'}`;
        queryString += "order_by=" + orderByString + '&'
    }

    /** Fetch documents as a dictionary */
    if (args?.asDict) {
        queryString += "as_dict=" + args.asDict
    }

    return queryString

}

/**
 * Hook to fetch a list of documents from the database
 * 
 * @param doctype Name of the doctype to fetch
 * @param args Arguments to pass (filters, pagination, etc)
 * @param options [Optional] SWRConfiguration options for fetching data
 * @returns an object (SWRResponse) with the following properties: data, error, isValidating, and mutate
 * 
* @typeParam T - The type definition of the document object
 */
export const useFrappeGetDocList = <T,>(doctype: string, args?: GetDocListArgs, swrKey?: Key, options?: SWRConfiguration): SWRResponse<T[], Error> => {

    const { db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<T[], Error>(swrKey === undefined ? `${db.getRequestURL(doctype)}?${getDocListQueryString(args)}` : swrKey, () => db.getDocList<T>(doctype, args), options)

    return {
        ...swrResult
    }
}

/**
 * Hook to create a document in the database and maintain loading and error states
 * @returns Object with the following properties: loading, error, isCompleted and createDoc and reset functions
 */
export const useFrappeCreateDoc = <T,>(): {
    /** Function to create a document in the database */
    createDoc: (doctype: string, doc: T) => Promise<FrappeDoc<T>>,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null | undefined,
    /** Will be true if document is created. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { db } = useContext(FrappeContext) as FrappeConfig
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const createDoc = useCallback(async (doctype: string, doc: T) => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)

        return db.createDoc<T>(doctype, doc)
            .then((document) => {
                setLoading(false)
                setIsCompleted(true)
                return document
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        createDoc,
        loading,
        error,
        isCompleted,
        reset
    }
}

/**
 * Hook to update a document in the database and maintain loading and error states
 * @returns Object with the following properties: loading, error, isCompleted and updateDoc and reset functions
 */
export const useFrappeUpdateDoc = <T,>(): {
    /** Function to update a document in the database */
    updateDoc: (doctype: string, docname: string | null, doc: Partial<T>) => Promise<FrappeDoc<T>>,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null | undefined,
    /** Will be true if document is created. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { db } = useContext(FrappeContext) as FrappeConfig
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const updateDoc = useCallback(async (doctype: string, docname: string | null, doc: Partial<T>) => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)
        return db.updateDoc<T>(doctype, docname, doc)
            .then((document) => {
                setLoading(false)
                setIsCompleted(true)
                return document
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        updateDoc,
        loading,
        error,
        reset,
        isCompleted
    }
}

/**
 * Hook to delete a document in the database and maintain loading and error states
 * @returns Object with the following properties: loading, error, isCompleted and deleteDoc and reset functions
 */
export const useFrappeDeleteDoc = (): {
    /** Function to delete a document in the database. Returns a promise which resolves to an object with message "ok" if successful */
    deleteDoc: (doctype: string, docname?: string | null) => Promise<{ message: string }>,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null | undefined,
    /** Will be true if document is created. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { db } = useContext(FrappeContext) as FrappeConfig
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const deleteDoc = useCallback(async (doctype: string, docname?: string | null): Promise<{ message: string }> => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)

        return db.deleteDoc(doctype, docname)
            .then((message) => {
                setLoading(false)
                setIsCompleted(true)
                return message
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        deleteDoc,
        loading,
        error,
        reset,
        isCompleted
    }
}

function encodeQueryData(data: Record<string, any>) {
    const ret = [];
    for (let d in data)
        ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
    return ret.join('&');
}

/**
 * Hook to fetch number of documents from the database
 * 
 * 
 * @param doctype - The doctype to fetch
 * @param filters - filters to apply to the query
 * @param cache - Whether to cache the result or not. Defaults to false
 * @param debug - Whether to log debug messages or not. Defaults to false
 * @param options [Optional] SWRConfiguration options for fetching data
 * @returns an object (SWRResponse) with the following properties: data (number), error, isValidating, and mutate
 * 
 */
export const useFrappeGetDocCount = (doctype: string, filters?: Filter[], cache: boolean = false, debug: boolean = false, swrKey?: Key, options?: SWRConfiguration): SWRResponse<number, Error> => {

    const { url, db } = useContext(FrappeContext) as FrappeConfig
    const getUniqueURLKey = () => {
        const params = encodeQueryData(cache ? { doctype, filters: filters ?? [], cache, debug } : { doctype, filters: filters ?? [], debug: debug })
        // console.log(`${url}/api/method/frappe.client.get_count?${params.toString()}`)
        return `${url}/api/method/frappe.client.get_count?${params}`
    }
    const swrResult = useSWR<number, Error>(swrKey === undefined ? getUniqueURLKey() : swrKey, () => db.getCount(doctype, filters, cache, debug), options)

    return {
        ...swrResult
    }
}

/**
 *  Hook to make a GET request to the server
 * 
 * @param method - name of the method to call (will be dotted path e.g. "frappe.client.get_list")
 * @param params - parameters to pass to the method
 * @param swrKey - optional SWRKey that will be used to cache the result. If not provided, the method name with the URL params will be used as the key
 * @param options [Optional] SWRConfiguration options for fetching data
 * 
 * @typeParam T - Type of the data returned by the method
 * @returns an object (SWRResponse) with the following properties: data (number), error, isValidating, and mutate
 */
export const useFrappeGetCall = <T,>(method: string, params?: Record<string, any>, swrKey?: Key, options?: SWRConfiguration): SWRResponse<T, Error> => {

    const { call } = useContext(FrappeContext) as FrappeConfig
    const urlParams = encodeQueryData(params ?? {})
    const url = `${method}?${urlParams}`

    const swrResult = useSWR<T, Error>(swrKey === undefined ? url : swrKey, () => call.get<T>(method, params), options)

    return {
        ...swrResult
    }
}

/**
 * 
 * @param method - name of the method to call (POST request) (will be dotted path e.g. "frappe.client.set_value")
 * @returns an object with the following properties: loading, error, isCompleted , result, and call and reset functions
 */
export const useFrappePostCall = <T,>(method: string): {
    /** Function to call the method. Returns a promise which resolves to the data returned by the method */
    call: (params: Record<string, any>) => Promise<T>,
    /** The result of the API call */
    result: T | null,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null,
    /** Will be true if API call is successful. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { call: frappeCall } = useContext(FrappeContext) as FrappeConfig

    const [result, setResult] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setResult(null)
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const call = useCallback(async (params: Record<string, any>): Promise<T> => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)
        setResult(null)

        return frappeCall.post<T>(method, params)
            .then((message) => {
                setResult(message)
                setLoading(false)
                setIsCompleted(true)
                return message
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        call,
        result,
        loading,
        error,
        reset,
        isCompleted
    }
}

/**
 * 
 * @param method - name of the method to call (PUT request) (will be dotted path e.g. "frappe.client.set_value")
 * @returns an object with the following properties: loading, error, isCompleted , result, and call and reset functions
 */
export const useFrappePutCall = <T,>(method: string): {
    /** Function to call the method. Returns a promise which resolves to the data returned by the method */
    call: (params: Record<string, any>) => Promise<T>,
    /** The result of the API call */
    result: T | null,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null,
    /** Will be true if API call is successful. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { call: frappeCall } = useContext(FrappeContext) as FrappeConfig

    const [result, setResult] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setResult(null)
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const call = useCallback(async (params: Record<string, any>) => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)
        setResult(null)

        return frappeCall.put<T>(method, params)
            .then((message) => {
                setResult(message)
                setLoading(false)
                setIsCompleted(true)
                return message
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        call,
        result,
        loading,
        error,
        reset,
        isCompleted
    }
}

/**
 * 
 * @param method - name of the method to call (DELETE request) (will be dotted path e.g. "frappe.client.delete")
 * @returns an object with the following properties: loading, error, isCompleted , result, and call and reset functions
 */
export const useFrappeDeleteCall = <T,>(method: string): {
    /** Function to call the method. Returns a promise which resolves to the data returned by the method */
    call: (params: Record<string, any>) => Promise<T>,
    /** The result of the API call */
    result: T | null,
    /** Will be true when the API request is pending.  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null,
    /** Will be true if API call is successful. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { call: frappeCall } = useContext(FrappeContext) as FrappeConfig

    const [result, setResult] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)



    const reset = useCallback(() => {
        setResult(null)
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    const call = useCallback(async (params: Record<string, any>) => {
        setError(null)
        setIsCompleted(false)
        setLoading(true)
        setResult(null)

        return frappeCall.delete<T>(method, params)
            .then((message) => {
                setResult(message)
                setLoading(false)
                setIsCompleted(true)
                return message
            })
            .catch((error) => {
                setLoading(false)
                setIsCompleted(false)
                setError(error)
                throw error
            })
    }, [])

    return {
        call,
        result,
        loading,
        error,
        reset,
        isCompleted
    }
}

export interface FrappeFileUploadResponse {
    /** Name of the file documnet in the database */
    "name": string,
    "owner": string,
    "creation": string,
    "modified": string,
    "modified_by": string,
    "docstatus": 0 | 1 | 2,
    "idx": number,
    /** Name of the uploaded file */
    "file_name": string,
    /** File is not accessible by guest users */
    "is_private": 1 | 0,
    "is_home_folder": 0 | 1,
    "is_attachments_folder": 0 | 1,
    /** File size in bytes */
    "file_size": number,
    /** Path of the file ex: /private/files/file_name.jpg  */
    "file_url": string,
    "folder": string,
    "is_folder": 0 | 1,
    /** Doctype the file is linked to */
    "attached_to_doctype": string,
    /** Document the file is linked to */
    "attached_to_name": string,
    "content_hash": string,
    "uploaded_to_dropbox": 0 | 1,
    "uploaded_to_google_drive": 0 | 1,
    "doctype": "File"
}

/**
 * Hook to upload files to the server
 * 
 * @returns an object with the following properties: loading, error, isCompleted , result, and call and reset functions
 */
export const useFrappeFileUpload = (): {
    /** Function to upload the file */
    upload: (file: File, args: FileArgs) => Promise<FrappeFileUploadResponse>,
    /** Upload Progress in % - rounded off */
    progress: number,
    /** Will be true when the file is being uploaded  */
    loading: boolean,
    /** Error object returned from API call */
    error: Error | null,
    /** Will be true if file upload is successful. Else false */
    isCompleted: boolean,
    /** Function to reset the state of the hook */
    reset: () => void
} => {

    const { file } = useContext(FrappeContext) as FrappeConfig
    const [progress, setProgress] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [isCompleted, setIsCompleted] = useState(false)

    const upload = useCallback(async (f: File, args: FileArgs) => {
        reset()
        setLoading(true)
        return file.uploadFile(f, args, (c, t) => setProgress(Math.round((c / t) * 100))
        )
            .then((r) => {
                setIsCompleted(true)
                setProgress(100)
                setLoading(false)
                return r.data.message
            })
            .catch(e => {
                console.error(e)
                setError(e)
                setLoading(false)
                throw e
            })

    }, [])

    const reset = useCallback(() => {
        setProgress(0)
        setLoading(false)
        setError(null)
        setIsCompleted(false)
    }, [])

    return {
        upload,
        progress,
        loading,
        isCompleted,
        error,
        reset
    }

}

export interface SearchResult {
    value: string,
    label: string,
    description: string
}

/**
 * Hook to search for documents
 * 
  * @param doctype - name of the doctype (table) where we are performing our search
  * @param text - search text
  * @param filters - (optional) the results will be filtered based on these 
  * @param limit - (optional) the number of results to return. Defaults to 20
  * @param debounce - (optional) the number of milliseconds to wait before making the API call. Defaults to 250ms.
  * @returns result - array of type SearchResult with a list of suggestions based on search text
  */
export const useSearch = (doctype: string, text: string, filters: Filter[] = [], limit: number = 20, debounce: number = 250) => {
    const debouncedText = useDebounce(text, debounce);
    const swrResult = useFrappeGetCall<{ results: SearchResult[] }>('frappe.desk.search.search_link', {
        doctype,
        page_length: limit,
        txt: debouncedText,
        filters: JSON.stringify(filters ?? [])
    })
    return swrResult
}

/**
 * Hook to debounce user input
 * @param value - the value to be debounced
 * @param delay - the number of milliseconds to wait before returning the value
 * @returns string value after the specified delay
 */
const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}


/** Hook for fetching,store and sync Document in IndexDB
 * 
 * 
 * @param doctype - the doctype to fetch
 * @param name - name of the document to fetch
 * 
 * @returns object (SWRResponse) with the following properties: data, error, isValidating, mutate and custom function delete
 * 
 * @typeParam T - The type of the document to fetch
 */
export const useFrappeGetDocOffline = <T,>(doctype: string, name?: string) => {
    /** 1. check if data is in indexedDB.
     * - If lastFetched is null - we are loading data from indexedDB
     * - If lastFetched is undefined - we do not have any data in indexedDB
     * - If lastFetched is not null or undefined - we have data in indexedDB - proceed to check for latest timestamp
     */

    //Initialise database
    const { indexdb } = useContext(FrappeContext) as FrappeConfig

    const lastFetched: lastFetchType | null = useGetLastFetched(indexdb, doctype, name);

    const lastFetchExist: boolean = lastFetched !== undefined && lastFetched !== null;

    /** 2. Check if user has permission to read the document
   *  - If user has permission - proceed to check for latest timestamp
   *  - If user does not have permission - delete the document from indexedDB
   */

    const { data: permission, error: permissionError } = useFrappeGetCall<{ message: { has_permission: boolean } }>('frappe.client.has_permission', {
        doctype,
        docname: name,
        ptype: 'read'
    })

    const hasPermission: boolean | undefined = permission?.message.has_permission;

    /**
     * 3. Fetch timestamp from frappe for document
     * - If lastFetched is null or undefined - then we do not fetch timestamp from frappe
     * - However, if lastFetched has data - we fetch timestamp from frappe for comparison
     */
    const { data: modified } = useFrappeGetCall<{ message: { modified: string } }>(
        'frappe.client.get_value',
        {
            doctype,
            filters: { name },
            fieldname: 'modified',
        },
        lastFetchExist && hasPermission ? undefined : null
    );

    const [shouldLoad, setShouldLoad] = useState<boolean>(false);

    useEffect(() => {
        if (!hasPermission) {
            if (lastFetchExist) {
                indexdb.table("docs").delete(`${doctype}_${name}`);
            }
        }
        else {
            if (lastFetched === undefined) {
                setShouldLoad(true);
            } else if (
                lastFetchExist &&
                modified &&
                modified.message.modified &&
                modified.message.modified !== lastFetched?.modified
            ) {
                setShouldLoad(true);
            } else if (
                lastFetchExist &&
                modified &&
                modified.message.modified === undefined
            ) {
                setShouldLoad(true);
            }
        }
    }, [lastFetched, modified, hasPermission, lastFetchExist]);

    const { data, error, mutate, isLoading, isValidating } = useFrappeGetDoc<T>(
        doctype,
        name,
        shouldLoad && hasPermission ? undefined : null
    );

    /** Store in indexedDB if data is fetched from server */
    useEffect(() => {
        if (data) {
            indexdb.table("docs").put({
                _id: `${doctype}_${name}`,
                lastFetchedOn: new Date(),
                modified: data.modified,
                name: name,
                doctype: doctype,
                data: { ...data },
                count: 1,
            });
        } else if (error && lastFetchExist) {
            indexdb.table("docs").delete(`${doctype}_${name}`);
        }
    }, [data]);

    const forceRefresh = () => {
        if (shouldLoad) {
            mutate();
        } else {
            setShouldLoad(true);
        }
    };

    const forceDelete = () => {
        setShouldLoad(false);
        if (lastFetchExist) {
            indexdb.table("docs").delete(`${doctype}_${name}`);
        }
    }

    return {
        isLoadedFromServer: shouldLoad,
        data: shouldLoad ? data : lastFetched ? lastFetched.data : undefined,
        error: hasPermission ? error : new CustomError(403, "FORBIDDEN", "there was an error", `frappe.exceptions.PermissionError: No permission for ${doctype}`),
        mutate: forceRefresh,
        delete: forceDelete,
        isLoading: shouldLoad ? isLoading : lastFetched === undefined,
        isValidating: shouldLoad ? isValidating : false,
    };
};

/**
 * Hook to fetch,store and sync a list of documents in IndexDB
 * 
 * @param doctype Name of the doctype to fetch
 * @param args Arguments to pass (filters, pagination, etc)
 *
 * @returns an object (SWRResponse) with the following properties: data, error, isValidating, mutate and custom function delete
 *
 * @typeParam T - The type definition of the document object to fetch
 */
export const useFrappeGetDocListOffline = <T,>(doctype: string, args?: GetDocListArgs) => {
    /** 1. check if data is in indexedDB.
     * - If lastFetched is null - we are loading data from indexedDB
     * - If lastFetched is undefined - we do not have any data in indexedDB
     * - If lastFetched is not null or undefined - we have data in indexedDB - proceed to check for latest count
     */

    //Initialise database
    const { indexdb } = useContext(FrappeContext) as FrappeConfig

    const lastFetchedList: lastFetchType | null = useGetLastFetched(indexdb, doctype, getDocListQueryString(args));

    const lastFetchExist =
        lastFetchedList !== undefined && lastFetchedList !== null;

    /** 2. Check if user has permission to read the document list
    * - If user has permission - proceed to check for latest count
    * - If user does not have permission - delete the document list from indexedDB
    */

    const { data: permission, error: permissionError } = useFrappeGetCall<{ message: { has_permission: boolean } }>('frappe.client.has_permission', {
        doctype,
        docname: "",
        ptype: 'read'
    });

    const hasPermission: boolean | undefined = permission?.message.has_permission

    /** 3. Fetch count from frappe for document */

    const { data: listCount } = useFrappeGetDocCount(doctype, args?.filters, undefined, undefined, hasPermission ? undefined : null);

    const countNotChanged: boolean =
        lastFetchExist &&
        listCount !== undefined &&
        listCount === lastFetchedList.count;

    /** 4. Fetch timestamp from frappe for document if lastFetchedList is not null or undefined and count is
     *     not equal to lastFetchedList.count
     */

    const { data: modified } = useFrappeGetDocList<modifiedType>(
        doctype,
        {
            filters: args?.filters,
            fields: ['modified'],
            limit: 1,
            orderBy: {
                field: 'modified',
                order: 'desc',
            },
        },
        countNotChanged ? undefined : null
    );

    /** 5. Set shouldLoad state to true
     * - If lastFetchedList is undefined - we do not have any data in indexedDB
     * - If lastFetchedList is not undefined and count is not equal to lastFetchedList.count - we have data in indexedDB
     * - If lastFetchedList is not undefined and modified is not equal to lastFetchedList.modified - we have data in indexedDB
     */

    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (!hasPermission) {
            if (lastFetchExist) {
                indexdb.table("docs").delete(`${doctype}_${getDocListQueryString(args)}`);
            }
        }
        else {
            if (lastFetchedList === undefined) {
                setShouldLoad(true);
            } else if (lastFetchExist && lastFetchedList) {
                if (
                    (listCount || listCount === 0) &&
                    listCount !== lastFetchedList.count
                ) {
                    setShouldLoad(true);
                } else if (
                    modified &&
                    modified[0] &&
                    convertDateToMiliseconds(modified[0].modified) >
                    Math.floor(lastFetchedList.lastFetchedOn.getTime())
                ) {
                    setShouldLoad(true);
                }
            }
        }
    }, [lastFetchExist, lastFetchedList, listCount, modified, hasPermission]);

    /** 6. Fetch data from frappe if shouldLoad is true
     */
    const { data, error, mutate, isLoading, isValidating } = useFrappeGetDocList<T>(
        doctype,
        args,
        shouldLoad && hasPermission ? undefined : null
    );

    /** 7. Store in indexedDB if data is fetched from server */

    useEffect(() => {
        if (data) {
            console.log('Runs');
            indexdb.table("docs").put({
                _id: `${doctype}_${getDocListQueryString(args)}`,
                name: `${doctype}_${getDocListQueryString(args)}`,
                doctype: doctype,
                lastFetchedOn: new Date(),
                modified: modified && modified[0] && modified[0].modified ? modified[0].modified : formatedTimestamp(new Date()),
                count: listCount,
                data: { ...data },
            });
        } else if (error && lastFetchExist) {
            indexdb.table("docs").delete(`${doctype}_${getDocListQueryString(args)}`);
        }
    }, [data]);

    const forceRefresh = () => {
        if (shouldLoad) {
            mutate();
        } else {
            setShouldLoad(true);
        }
    };

    const forceDelete = () => {
        setShouldLoad(false);
        if (lastFetchExist) {
            indexdb.table("docs").delete(`${doctype}_${getDocListQueryString(args)}`);
        }
    }

    return {
        isLoadedFromServer: shouldLoad,
        data: shouldLoad ? data : lastFetchedList?.data,
        error: hasPermission ? error : new CustomError(403, "FORBIDDEN", "there was an error", `frappe.exceptions.PermissionError: No permission for ${doctype}`),
        mutate: forceRefresh,
        delete: forceDelete,
        isLoading: shouldLoad ? isLoading : lastFetchedList === undefined,
        isValidating: shouldLoad ? isValidating : false,
    };
};

/**
 * Hook for fetch,store and sync data from Indexdb for Get Doc
 * 
 * @param method - name of the method to call (will be dotted path e.g. "frappe.client.get_list")
 * @param params [Optional] parameters to pass to the method
 * @param lastModified [Optional] last modified date of the data
 * 
 * @returns an object (SWRResponse) with the following properties: data (number), error, isValidating, mutate and custom function delete
 * 
 * @typeParam T - Type of the data returned by the method
 */
export const useFrappeGetCallOffline = <T,>(method: string, params?: Record<string, any>, lastModified?: string | Date) => {
    /** 1. Check if data is in indexedDB
     * - If lastFetchData is null - we are loading data from indexedDB
     * - If lastFetchData is undefined - we do not have any data in indexedDB
     * - If lastFetchData is not null or undefined - we have data in indexedDB
     * - Fetch data from indexedDB
     */

    //Intialize database
    const { indexdb } = useContext(FrappeContext) as FrappeConfig

    const lastFetchedData: lastFetchType | null = useGetLastFetched(indexdb, method, encodeQueryData(params ?? {}));

    // Check if data is in indexedDB
    const lastFetchExist: boolean =
        lastFetchedData !== undefined && lastFetchedData !== null;

    /** 2. If data is in indexedDB - check if data is modified
     *  - If data is not in indexedDB - set shouldLoad to true
     */

    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (lastFetchedData === undefined) {
            setShouldLoad(true);
        } else if (
            lastFetchExist &&
            lastModified &&
            convertDateToMilisecondsForGetCall(lastModified)! >
            Math.floor(lastFetchedData!.lastFetchedOn.getTime())
        ) {
            setShouldLoad(true);
        }
    }, [lastFetchedData, lastModified]);

    /** 3. Fetch data from frappe if shouldLoad is true */
    const { data, error, mutate, isLoading, isValidating } = useFrappeGetCall(
        method,
        params,
        shouldLoad ? undefined : null
    );

    /** 4. Store in indexedDB if data is fetched from server
     * - If data is fetched from server - store in indexedDB
     * - If data is not fetched from server - delete from indexedDB*/

    useEffect(() => {
        if (data) {
            indexdb.table("docs").put({
                _id: `${method}_${encodeQueryData(params ?? {})}`,
                name: `${method}_${encodeQueryData(params ?? {})}`,
                doctype: method,
                lastFetchedOn: new Date(),
                modified: lastModified
                    ? checkTypeOfDate(lastModified)
                    : formatedTimestamp(new Date()),
                count: 1,
                data: { ...data },
            });
        } else if (error && lastFetchExist) {
            indexdb.table("docs").delete(`${method}_${params}`);
        }
    }, [data]);

    const forceRefresh = () => {
        if (shouldLoad) {
            mutate();
        } else {
            setShouldLoad(true);
        }
    };

    const forceDelete = () => {
        setShouldLoad(false);
        if (lastFetchExist) {
            indexdb.table("docs").delete(`${method}_${encodeQueryData(params ?? {})}`);
        }
    }

    // Return Data

    return {
        isLoadedFromServer: shouldLoad,
        data: shouldLoad ? data : lastFetchedData?.data,
        error,
        mutate: forceRefresh,
        delete: forceDelete,
        isLoading: shouldLoad ? isLoading : lastFetchedData === undefined,
        isValidating: shouldLoad ? isValidating : false,
    };
};

/**Custom Hook for fetch data from Indexdb for Get Doc */
export const useGetLastFetched = (db: any, doctype_or_method: string, name_or_args?: string) => {
    const [lastFetched, setLastFetched] = useState<lastFetchType | null>(null);

    useEffect(() => {
        const getLastFetched = async () => {
            return await db.table("docs").get(`${doctype_or_method}_${name_or_args}`);
        };

        getLastFetched().then((l) => {
            setLastFetched(l);
            // console.log('lastFetched', lastFetched);
        });
    }, [doctype_or_method, name_or_args]);

    return lastFetched;
};

// /**Function for converting string or object date to miliseconds */
export const convertDateToMilisecondsForGetCall = (date: string | Date) => {
    if (typeof date === 'string') {
        return convertDateToMiliseconds(date);
    } else if (typeof date === 'object') {
        return Math.floor(date.getTime());
    }
};

// /**Function for check type of date and return date in string format */
export const checkTypeOfDate = (date: string | Date) => {
    if (typeof date === 'string') {
        return date;
    } else if (typeof date === 'object') {
        return formatedTimestamp(date);
    }
};

// /**Function for converting string date to miliseconds */
export const convertDateToMiliseconds = (dateStr: string) => {
    const [dateComponents, timeComponents] = dateStr.split(' ');
    // console.log(dateComponents); // 👉️ "06/26/2022"
    // console.log(timeComponents); // 👉️ "04:35:12"

    const [year, month, day] = dateComponents.split('-');
    const [hours, minutes, seconds] = timeComponents.split(':');

    const date = new Date(+year, parseInt(month) - 1, +day, +hours, +minutes, +seconds);
    // console.log(date); // 👉️ Sun Jun 26 2022 04:35:12

    const timestampInMiliseconds = Math.floor(date.getTime());

    return timestampInMiliseconds;
};

// /**Function for converting date object to string */
export const formatedTimestamp = (d: Date) => {
    const date = d.toISOString().split('T')[0];
    const time = d.toTimeString().split(' ')[0];
    return `${date} ${time}`;
};


export class CustomError {
    httpStatus: number;
    httpStatusText: string;
    message: string;
    exception: string;
    constructor(httpStatus: number, httpStatusText: string, message: string, exception: string) {
        this.httpStatus = httpStatus;
        this.httpStatusText = httpStatusText;
        this.message = message;
        this.exception = exception;
    }
}