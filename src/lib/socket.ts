import io from 'socket.io-client'
import { Socket } from 'socket.io-client'
import { TokenParams } from '.';

/** Socket class
 * @param url [Optional] url to connect to
 * @param socket_port [Optional] port to connect to
 * @returns socket object
 * 
 * if url is not provided, it will be set to the current host and require socket_port
 * if socket_port is not provided, it will be set to 9000
*/
export class SocketIO {
    private socket_port: string | undefined;
    private host: string;
    private port: string;
    private protocol: string;
    private url: string;
    private site_name: string | undefined;
    public socket: Socket;


    constructor(url?: string, site_name?: string, socket_port?: string, tokenParams?: TokenParams) {
        this.socket_port = socket_port ?? "9000";
        this.host = window.location?.hostname;
        this.port = window.location?.port ? `:${this.socket_port}` : '';
        this.protocol = window.location?.protocol === 'https:' ? 'https' : 'http';
        if(url){
            // If URL is specified, we need to remove the port from it if it exists. 
            //If a socket port is passed on, then we need to append it to URL
            let urlObject = new URL(url)
            urlObject.port = ''
            if(socket_port){
                urlObject.port = socket_port
                this.url = urlObject.toString()
            }else{
                this.url = urlObject.toString()
            }
        }else{
            // If a URL is not specified (mostly on prod systems), then we can fetch it from the window
            this.url = `${this.protocol}://${this.host}${this.port}/`;
        }

        if (site_name){
            this.url = `${this.url}${site_name}`
        }
        this.site_name = site_name;
        this.socket = io(`${this.url}`, { withCredentials: true, secure: this.protocol === 'https', extraHeaders: tokenParams && tokenParams.useToken ===true ? {
                Authorization: `${tokenParams.type} ${tokenParams.token?.()}`} : {}
        });
    }
}