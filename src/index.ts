// src/index.ts
function greet(name: string): string {
    return `Hello, ${name}!`;
}

const userName: string = "World";
console.log(greet(userName));

// Example of a simple Node.js HTTP server
import * as http from 'http';

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello from TypeScript Node.js!\n');
});

const port = 3000;
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});