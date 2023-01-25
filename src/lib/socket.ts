import io from 'socket.io-client'
import { Socket } from 'socket.io-client'

/** Socket class
 * @param url [Optional] url to connect to
 * @param socket_port [Optional] port to connect to
 * @returns socket object
 * 
 * if url is not provided, it will be set to the current host and require socket_port
 * if socket_port is not provided, it will be set to 9001
*/
export class SocketIO {
    private socket_port: string | undefined;
    private host: string;
    private port: string;
    private protocol: string;
    private url: string;
    public socket: Socket;

    constructor(url?: string, socket_port?: string) {
        this.socket_port = socket_port ?? "9001";
        this.host = window.location.hostname;
        this.port = window.location.port ? `:${this.socket_port}` : '';
        this.protocol = this.port ? 'http' : 'https';
        this.url = url ?? `${this.protocol}://${this.host}${this.port}`;
        this.socket = io(this.url, { withCredentials: true });
    }
}