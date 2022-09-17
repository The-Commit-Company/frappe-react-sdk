import { PropsWithChildren, useMemo } from "react";
import { createContext } from "react";
import { FrappeApp, FrappeAuth, FrappeCall } from "frappe-js-sdk";
import { FrappeDB } from "frappe-js-sdk/lib/db";
import { FrappeFileUpload } from "frappe-js-sdk/lib/file";
import { Error } from 'frappe-js-sdk/lib/frappe_app/types';
import { Filter, FrappeDoc, GetDocListArgs } from 'frappe-js-sdk/lib/db/types'
import { useCallback, useContext, useEffect, useState } from 'react'
import useSWR, { SWRConfiguration, SWRResponse } from 'swr'
import { FileArgs } from 'frappe-js-sdk/lib/file/types';


export type { SWRConfiguration, SWRResponse }

export type { FrappeDoc, GetDocListArgs, Filter, FileArgs, Error }
export interface FrappeConfig {
    /** The URL of your Frappe server */
    url: string;
    app: FrappeApp,
    auth: FrappeAuth,
    db: FrappeDB,
    call: FrappeCall,
    file: FrappeFileUpload
}
export const FrappeContext = createContext<null | FrappeConfig>(null)

type FrappeProviderProps = PropsWithChildren<{ url?: string }>

export const FrappeProvider = ({ url = "", children }: FrappeProviderProps) => {

    const frappeConfig: FrappeConfig = useMemo(() => {
        //Add your Frappe backend's URL
        const frappe = new FrappeApp(url)

        return {
            url,
            app: frappe,
            auth: frappe.auth(),
            db: frappe.db(),
            call: frappe.call(),
            file: frappe.file()
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

    const { url, auth } = useContext(FrappeContext) as FrappeConfig

    const { data: currentUser, error, isValidating, mutate: updateCurrentUser } = useSWR<string | null, Error>(`${url}/api/method/frappe.auth.get_logged_user`, () => auth.getLoggedInUser(), options)

    const login = useCallback(async (username: string, password: string) => {
        return auth.loginWithUsernamePassword({ username, password }).then((m) => {
            console.log(m)
            updateCurrentUser()
        })
    }, [])

    const logout = useCallback(async () => {
        return auth.logout().then(() => updateCurrentUser(null))
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
export const useFrappeGetDoc = <T,>(doctype: string, name?: string, options?: SWRConfiguration): SWRResponse<FrappeDoc<T>, Error> => {

    const { db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<FrappeDoc<T>, Error>(db.getRequestURL(doctype, name), () => db.getDoc<T>(doctype, name), options)

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
export const useFrappeGetDocList = <T,>(doctype: string, args?: GetDocListArgs, options?: SWRConfiguration): SWRResponse<T[], Error> => {

    const { db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<T[], Error>(`${db.getRequestURL(doctype)}?${getDocListQueryString(args)}`, () => db.getDocList<T>(doctype, args), options)

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
export const useFrappeGetDocCount = (doctype: string, filters?: Filter[], cache: boolean = false, debug: boolean = false, options?: SWRConfiguration): SWRResponse<number, Error> => {

    const { url, db } = useContext(FrappeContext) as FrappeConfig
    const getUniqueURLKey = () => {
        const params = encodeQueryData({ filters: filters ?? [], cache, debug })
        // console.log(`${url}/api/method/frappe.client.get_count?${params.toString()}`)
        return `${url}/api/method/frappe.client.get_count?${params}`
    }
    const swrResult = useSWR<number, Error>(getUniqueURLKey(), () => db.getCount(doctype, filters, cache, debug), options)

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
export const useFrappeGetCall = <T,>(method: string, params?: Record<string, any>, swrKey?: string, options?: SWRConfiguration): SWRResponse<T, Error> => {

    const { call } = useContext(FrappeContext) as FrappeConfig
    const urlParams = encodeQueryData(params ?? {})
    const url = `${method}?${urlParams}`

    const swrResult = useSWR<T, Error>(swrKey ?? url, () => call.get<T>(method, params), options)

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
    const swrResult = useFrappeGetCall<{ results: SearchResult[] }>('/api/method/frappe.desk.search.search_link', {
        doctype,
        page_length: limit,
        txt: debouncedText,
        filters: filters ?? []
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
