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
        this.protocol = this.port ? 'http' : 'https';
        this.url = url ? url : `${this.protocol}://${this.host}${this.port}`;
        //@ts-ignore
        this.site_name = site_name ?? frappe?.boot.sitename
        this.socket = io(`${this.url}/${this.site_name}`, { withCredentials: true, secure: this.protocol === 'https', extraHeaders: tokenParams && tokenParams.useToken ===true ? {
                Authorization: `${tokenParams.type} ${tokenParams.token}`} : {}
        });
    }
}