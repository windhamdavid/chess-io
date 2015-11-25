import io from 'socket.io-client';


const HOST = 'http://localhost:8181';

export default io.connect(HOST);
