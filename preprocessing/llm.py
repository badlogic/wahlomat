from openai import OpenAI
import tiktoken
import os

client = OpenAI(api_key = os.getenv("OPENAI_KEY"))
messages = []
model_name="gpt-4o-mini"
max_tokens = 12000
temperature=0

enc = tiktoken.get_encoding("cl100k_base")
def num_tokens(message):
    return len(enc.encode(message))

def truncate_messages(messages, max_tokens):
    total_tokens = sum(num_tokens(message["content"]) for message in messages)
    if total_tokens <= max_tokens:
        return messages

    truncated_messages = messages[:1]
    remaining_tokens = max_tokens - num_tokens(truncated_messages[0]["content"])
    for message in reversed(messages[1:]):
        tokens = num_tokens(message["content"])
        if remaining_tokens >= tokens:
            truncated_messages.insert(1, message)
            remaining_tokens -= tokens
        else:
            break
    return truncated_messages

def complete(message, max_response_tokens=2048):
    global messages
    messages.append({"role": "user", "content": message})
    truncated_messages = truncate_messages(messages, max_tokens=max_tokens)
    stream = client.chat.completions.create(
        model=model_name,
        messages=truncated_messages,
        stream=True,
        temperature=temperature,
        max_tokens=max_response_tokens
    )
    reply = ""
    for response in stream:
        token = response.choices[0].delta.content
        if (token is None):
            break
        reply += token
        print(token, end='')

    reply = {"role": "assistant", "content": reply}
    messages.append(reply)
    total_tokens = sum(num_tokens(message["content"]) for message in truncated_messages)
    print(f'\nTokens: {total_tokens}')
    return reply["content"]

def clear_history():
  global messages
  messages = []

def print_history():
  global messages
  for message in messages:
    print("<" + message["role"] + ">")
    print(message["content"])
    print()

def system_prompt(message):
  global messages
  prompt = { "role": "system", "content": message }
  if (len(messages) == 0):
    messages.append(prompt)
  else:
    messages[0] = prompt