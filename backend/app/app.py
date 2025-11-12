from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def default():
    return {"message":"helloworld"}



text_posts = {}

