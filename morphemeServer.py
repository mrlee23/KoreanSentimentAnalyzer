#!/usr/bin/env python3
import socket, sys, json
from konlpy.tag import Kkma
from konlpy.utils import pprint

kkma = Kkma()

FINISH_FLAG = bytes('__finished__', 'utf-8')

def checkFinished (data):
    global FINISH_FLAG
    if data[-len(FINISH_FLAG):] == FINISH_FLAG:
        return True
    else:
        return False

def eliminateFinished (data):
    global FINISH_FLAG
    return data[:-len(FINISH_FLAG)]

def sendData (connection, data):
    global FINISH_FLAG
    try:
        data = json.JSONEncoder().encode(data)
        data = bytes(data, 'utf-8')+FINISH_FLAG
        connection.sendall(data)
        return True
    except:
        print('[Send error]')
    
def recvData (connection):
    global FINISH_FLAG
    try:
        dataCollection = bytes('', 'utf-8')
        while True:
            data = connection.recv(30000)
            print('Received data(length: {})'.format(len(data)))
            if len(data) < 1:
                break
            dataCollection += data
            if checkFinished(dataCollection):
                dataCollection = eliminateFinished(dataCollection)
                break
        print('Collected data(length: {})'.format(len(dataCollection)))
        if (len(dataCollection) > 0):
            dataCollection = json.JSONDecoder().decode(dataCollection.decode())
        return dataCollection
    except:
        print('[Recv error')

def parseData (data):
    return parseKkma(data)

def parseKkma (data):
    if (type(data) == str):
        return kkma.pos(data)
    elif (type(data) == list):
        ret = []
        for doc in data:
            ret.append(parseKkma(doc))
        return ret

def listen(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    server_address = (host, port)

    try:
        print("[{}:{}] Starting up".format(*server_address))
        sock.bind(server_address)
        sock.listen(10)
    except:
        print("[{}:{}] Network is busy. exit.".format(*server_address))
        exit()

    while True:
        print("[{}:{}] Waiting for a connection.".format(*server_address))
        connection, client_address = sock.accept()
        try:
            print("[{}:{}] connection from".format(*server_address), client_address)

            while True:
                data = recvData(connection)
                if data:
                    parsedData = parseData(data)
                    del data
                    sendData(connection, parsedData)
                    del parsedData
                else:
                    print("[{}:{}] no data from".format(*server_address), client_address)
                    break
        finally:
            connection.close()

if __name__ == '__main__':
    # listen(sys.argv[1], sys.argv[2])
    if len(sys.argv) == 3:
        host, port = sys.argv[1:]
        listen(host, int(port))
    else:
        listen('localhost', 7000)
