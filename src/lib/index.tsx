import { PropsWithChildren, useMemo } from "react";
import { createContext } from "react";
import { FrappeApp, FrappeAuth, FrappeCall } from "frappe-js-sdk";
import { FrappeDB } from "frappe-js-sdk/lib/db";
import { FrappeFileUpload } from "frappe-js-sdk/lib/file";
import { Error } from 'frappe-js-sdk/lib/frappe_app/types';
import { Filter, FrappeDoc, GetDocListArgs } from 'frappe-js-sdk/lib/db/types'
import { useCallback, useContext, useEffect, useState } from 'react'
import useSWR, { Key, SWRConfiguration, SWRResponse, useSWRConfig, SWRConfig } from 'swr'
import useSWRInfinite from 'swr/infinite'
import { FileArgs } from 'frappe-js-sdk/lib/file/types';
import { Socket } from "socket.io-client";
import { SocketIO } from "./socket";
import { AuthCredentials, AuthResponse ,OTPCredentials,UserPassCredentials} from "frappe-js-sdk/lib/auth/types";

export type { SWRConfiguration, SWRResponse, Key }
export { useSWR, useSWRConfig, useSWRInfinite }
export type {OTPCredentials,UserPassCredentials,AuthCredentials,AuthResponse, FrappeDoc, GetDocListArgs, Filter, FileArgs, Error as FrappeError }
export interface FrappeConfig {
    /** The URL of your Frappe server */
    url: string;
    tokenParams?: TokenParams;
    app: FrappeApp,
    auth: FrappeAuth,
    db: FrappeDB,
    call: FrappeCall,
    file: FrappeFileUpload,
    socket?: Socket
}

export interface TokenParams {
    /** Whether to use token for API calls */
    useToken: boolean;
    /** Function that returns the token as a string - this could be fetched from LocalStorage or auth providers like Firebase, Auth0 etc. */
    token?: () => string;
    /** Type of token to be used for authentication */
    type: 'Bearer' | 'token'
}

export const FrappeContext = createContext<null | FrappeConfig>(null)

type FrappeProviderProps = PropsWithChildren<{ 
    url?: string, 
    tokenParams?: TokenParams, 
    /** Port on which Socket is running. Only meant for local development. Set to undefined on production. */
    socketPort?: string, 
    /** Get this from frappe.local.site on the server, or frappe.boot.sitename on the window.
     * Required for Socket connection to work in Frappe v14+
      */
    siteName?: string,
    /** Flag to disable socket, if needed. This defaults to true. */
    enableSocket?: boolean,
    swrConfig?: SWRConfiguration
 }>

export const FrappeProvider = ({ url = "", tokenParams, socketPort, swrConfig, siteName, enableSocket = true, children }: FrappeProviderProps) => {

    const frappeConfig: FrappeConfig = useMemo(() => {
        //Add your Frappe backend's URL
        const frappe = new FrappeApp(url, tokenParams)

        return {
            url,
            tokenParams,
            app: frappe,
            auth: frappe.auth(),
            db: frappe.db(),
            call: frappe.call(),
            file: frappe.file(),
            socket: enableSocket ? new SocketIO(url, siteName, socketPort,tokenParams).socket : undefined,
            enableSocket,
            socketPort
        }

    }, [url, tokenParams, socketPort, enableSocket])

    return <FrappeContext.Provider value={frappeConfig}>
            <SWRConfig value={swrConfig}>
                {children}
            </SWRConfig>
    </FrappeContext.Provider>
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
    /** Will be true when the hook is fetching user data  */
    isLoading: boolean,
    /** Will be true when the hook is fetching (or revalidating) the user state. (Refer to isValidating in useSWR)  */
    isValidating: boolean,
    /** Error object returned from API call */
    error: Error | null | undefined,
    /** Function to login the user with email and password */
    // login: ({username, password,otp,tmp_id}:AuthCredentials) => Promise<AuthResponse>,
    login:(credentials:AuthCredentials) => Promise<AuthResponse>,
    /** Function to log the user out */
    logout: () => Promise<any>,
    /** Function to fetch updated user state */
    updateCurrentUser: () => void,
    /** Function to get the user cookie and */
    getUserCookie: () => void
} => {

    const { url, auth, tokenParams } = useContext(FrappeContext) as FrappeConfig

    const [userID, setUserID] = useState<string | null | undefined>()

    const getUserCookie = useCallback(() => {
        const userCookie = document.cookie.split(';').find(c => c.trim().startsWith('user_id='))
        if (userCookie) {
            const userName = userCookie.split('=')[1]
            if (userName && userName !== "Guest") {
                setUserID(userName)
            } else {
                setUserID(null)
            }
        } else {
            setUserID(null)
        }
    }, [])

    useEffect(() => {
        //Only get user cookie if token is not used
        if (tokenParams && tokenParams.useToken) {
            setUserID(null)
        } else {
            getUserCookie()
        }

    }, [])

    const { data: currentUser, error, isLoading, isValidating, mutate: updateCurrentUser } = useSWR<string | null, Error>(
        () => {
            if ((tokenParams && tokenParams.useToken) || userID) {
                return `${url}/api/method/frappe.auth.get_logged_user`
            } else {
                return null
            }
        }, () => auth.getLoggedInUser(), {
        onError: () => {
            setUserID(null)
        },
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        ...options,
    })

    const login = useCallback(async (credentials:AuthCredentials) => {
        return auth.loginWithUsernamePassword(credentials)
        .then((m) => {
            getUserCookie()
            return m
        })
    }, [])

    const logout = useCallback(async () => {
        return auth.logout()
            .then(() => updateCurrentUser(null))
            .then(() => setUserID(null))
    }, [])

    return {
        isLoading: userID === undefined || isLoading,
        currentUser,
        isValidating,
        error,
        login,
        logout,
        updateCurrentUser,
        getUserCookie
    }
}

export const getRequestURL = (doctype: string, url: string, docname?: string | null): string => {
    let requestURL = `${url}/api/resource/`;
    if (docname) {
        requestURL += `${doctype}/${docname}`;
    } else {
        requestURL += `${doctype}`;
    }

    return requestURL;
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
export const useFrappeGetDoc = <T=any,>(doctype: string, name?: string, swrKey?: Key, options?: SWRConfiguration): SWRResponse<FrappeDoc<T>, Error> => {

    const { url, db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<FrappeDoc<T>, Error>(swrKey === undefined ? getRequestURL(doctype,url,name) : swrKey, () => db.getDoc<T>(doctype, name), options)

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

    if (args?.groupBy) {
        queryString += "group_by=" + String(args.groupBy) + '&'
    }

    /** Sort results by field and order  */
    if (args?.orderBy) {
        const orderByString = `${String(args.orderBy?.field)} ${args.orderBy?.order ?? 'asc'}`;
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
export const useFrappeGetDocList = <T=any,K=FrappeDoc<T>>(doctype: string, args?: GetDocListArgs<K>, swrKey?: Key, options?: SWRConfiguration) => {

    const { url, db } = useContext(FrappeContext) as FrappeConfig

    const swrResult = useSWR<T[], Error>(swrKey === undefined ? `${getRequestURL(doctype, url)}?${getDocListQueryString(args)}` : swrKey, () => db.getDocList<T, K>(doctype, args), options)

    return {
        ...swrResult
    }
}

/**
 * Hook to create a document in the database and maintain loading and error states
 * @returns Object with the following properties: loading, error, isCompleted and createDoc and reset functions
 */
export const useFrappeCreateDoc = <T=any,>(): {
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
export const useFrappeUpdateDoc = <T=any,>(): {
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
export const useFrappeGetDocCount = <T=any,>(doctype: string, filters?: Filter<T>[], cache: boolean = false, debug: boolean = false, swrKey?: Key, options?: SWRConfiguration): SWRResponse<number, Error> => {

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
export const useFrappeGetCall = <T=any,>(method: string, params?: Record<string, any>, swrKey?: Key, options?: SWRConfiguration): SWRResponse<T, Error> => {

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
export const useFrappePostCall = <T=any,>(method: string): {
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
export const useFrappePutCall = <T=any,>(method: string): {
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
export const useFrappeDeleteCall = <T=any,>(method: string): {
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
export const useFrappeFileUpload = <T = any>(): {
    /** Function to upload the file */
    upload: (file: File, args: FileArgs<T>, apiPath?: string) => Promise<FrappeFileUploadResponse>,
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

    const upload = useCallback(async (f: File, args: FileArgs<T>, apiPath?: string) => {
        reset()
        setLoading(true)
        return file.uploadFile(f, args, (c, t) => {
            if(t){
                setProgress(Math.round((c / t) * 100))
            }
        }, apiPath)
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
    const swrResult = useFrappeGetCall<{ message: SearchResult[] }>('frappe.desk.search.search_link', {
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


/* ---- Socket IO Hooks ---- */
/** useFrappeEventListener hook for listening to events from the server
 * @param eventName - name of the event to listen to
 * @param callback - callback function to be called when the event is triggered. The callback function will receive the data sent from the server. It is recommended to memoize this function.
 * 
 * @example
 * ```typescript
 * useFrappeEventListener('my_event', (data) => {
 *     // do something with the data
 *      if(data.status === 'success') {
 *          console.log('success')
 *      }
 * })
 * ```
 */
export const useFrappeEventListener = <T=any>(eventName: string, callback: (eventData: T) => void) => {

    const { socket } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        if(socket === undefined){
            console.warn('Socket is not enabled. Please enable socket in FrappeProvider.')
        }
        let listener = socket?.on(eventName, callback)

        return () => {
            listener?.off(eventName)
        }
    }, [eventName, callback])

}


export interface ViewerEventData {
    doctype: string,
    docname: string,
    users: string[],
}

export interface DocumentUpdateEventData {
    doctype: string,
    name: string,
    modified: string,
}
/**
 * Hook for listening to document events.
 * The hook will automatically subscribe to the document room, and unsubscribe when the component unmounts.
 * The hook listens to the following events:
 * - doc_update: This is triggered when the document is updated. The callback function will receive the updated document.
 * - doc_viewers: This is triggered when the list of viewers of the document changes. The hook will update the viewers state with the list of viewers.
 * 
 * @param doctype Name of the doctype
 * @param docname Name of the document
 * @param emitOpenCloseEventsOnMount [Optional] If true, the hook will emit doc_open and doc_close events on mount and unmount respectively. Defaults to true.
 * @param onUpdateCallback Function to be called when the document is updated. It is recommended to memoize this function.
 * @returns viewers - array of userID's, emitDocOpen - function to emit doc_open event, emitDocClose - function to emit doc_close event
 */
export const useFrappeDocumentEventListener = (
    doctype: string,
    docname: string,
    onUpdateCallback: (eventData: DocumentUpdateEventData) => void,
    emitOpenCloseEventsOnMount: boolean = true,
) => {
    const { socket } = useContext(FrappeContext) as FrappeConfig

    /** Array of user IDs of users currently viewing the document. This is updated when "doc_viewers" event is published */
    const [viewers, setViewers] = useState<string[]>([])

    useEffect(() => {
        if(socket === undefined){
            console.warn('Socket is not enabled. Please enable socket in FrappeProvider.')
        }
        socket?.emit('doc_subscribe', doctype, docname)

        // Re-subscribe on reconnect
        socket?.io.on("reconnect", () => {
            socket?.emit('doc_subscribe', doctype, docname)
        })

        if (emitOpenCloseEventsOnMount) {
            socket?.emit('doc_open', doctype, docname)
        }

        return () => {
            socket?.emit('doc_unsubscribe', doctype, docname)
            if (emitOpenCloseEventsOnMount) {
                socket?.emit('doc_close', doctype, docname)
            }
        }
    }, [doctype, docname, emitOpenCloseEventsOnMount]);

    useFrappeEventListener('doc_update', onUpdateCallback)

    /**
     * Emit doc_open event - this will explicitly send a doc_open event to the server.
     */
    const emitDocOpen = useCallback(() => {
        socket?.emit('doc_open', doctype, docname)
    }, [doctype, docname])

    /**
     * Emit doc_close event - this will explicitly send a doc_close event to the server.
     */
    const emitDocClose = useCallback(() => {
        socket?.emit('doc_close', doctype, docname)
    }, [doctype, docname])

    const onViewerEvent = useCallback((data: ViewerEventData) => {
        if (data.doctype === doctype && data.docname === docname) {
            setViewers(data.users)
        }
    }, [doctype, docname])

    useFrappeEventListener('doc_viewers', onViewerEvent)

    return {
        /** Array of user IDs of users currently viewing the document. This is updated when "doc_viewers" event is published */
        viewers,
        /** Emit doc_open event - this will explicitly send a doc_open event to the server. */
        emitDocOpen,
        /** Emit doc_close event - this will explicitly send a doc_close event to the server. */
        emitDocClose,
    }

}


export interface DocTypeListUpdateEventData {
    doctype: string,
    name: string,
    user: string
}

/**
 * Hook for listening to doctype events.
 * The hook will automatically subscribe to the doctype room, and unsubscribe when the component unmounts.
 * The hook listens to the following event:
 * - list_update: This is triggered when a document of the doctype is updated (created, modified or deleted). The callback function will receive the updated document.
 * 
 * @param doctype Name of the doctype
 * @param onListUpdateCallback Function to be called when the document is updated. It is recommended to memoize this function.
 */
export const useFrappeDocTypeEventListener = (
    doctype: string,
    onListUpdateCallback: (eventData: DocTypeListUpdateEventData) => void,
) => {
    const { socket } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        if(socket === undefined){
            console.warn('Socket is not enabled. Please enable socket in FrappeProvider.')
        }
        socket?.emit('doctype_subscribe', doctype)

        // Re-subscribe on reconnect
        socket?.io.on("reconnect", () => {
            socket?.emit('doctype_subscribe', doctype)
        })
        return () => {
            socket?.emit('doctype_unsubscribe', doctype)
        }
    }, [doctype]);

    useFrappeEventListener('list_update', onListUpdateCallback)

}