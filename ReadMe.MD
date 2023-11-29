This is a fullstack chatbot created with React, Nodejs, OpenAi, and ChatGPT while developing the following tutorial:

[How To Build A Chat Bot Application With OpenAI, ChatGPT, Nodejs, And React](https://www.freecodecamp.org/news/how-to-build-a-chatbot-with-openai-chatgpt-nodejs-and-react/)

See the Video Tutorial: <br />
[![How to Build an AI-Powered ChatBot with OpenAI, ChatGPT, Node.js, and React](https://i.ytimg.com/vi/T-9-_1w82Jg/hqdefault.jpg?sqp=-oaymwEXCNACELwBSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLBvEKpZDH0nbnyAErAxl0Tt3ZodLA)](https://www.youtube.com/playlist?list=PLOvIwkWvHysNRNjLPcHHAWXrLzRkl__kR)

## Dependencies
### Backend
* [OpenAI](https://openai.com/)
* [ChatGPT](https://platform.openai.com/)
* [Readline](https://nodejs.org/api/readline.html)
* [Nodejs](https://nodejs.org/en)

### Frontend
* [React](https://react.dev/)
* [Vite](https://vitejs.dev/)

## Installation
* Clone this repo `https://github.com/almightyzeus/react-nodejs-chatgpt-tutorial.git`
* Navigate into the repo `cd react-nodejs-chatgpt-tutorial`

* Navigate into the `backend` folder `cd backend`
* Install the dependencies ``npm install``
* Replace the configuration data(API_KEY and ORG_ID) with your own data in the `Constants.js` file
* Ideally you should be storing the API_KEY in environment variables or use a keystore. 
Please refer [Best Practices for API Key Safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety#h_03e323d520)
* Run the `index.js` file `node index`

*That will start the backend server on port `8000`: http://localhost:8000/*

* Navigate into the `frontend` folder `cd frontend`
* Install the dependencies ``npm install``
* Start the local server ``npm run dev``

*That will open the project on your default browser: http://127.0.0.1:3000/ or http://localhost:3000/. You can now chat with the AI from your browser*
