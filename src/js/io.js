import io from 'socket.io-client';


const HOST = 'http://localhost:8888';

export default io.connect(HOST);
