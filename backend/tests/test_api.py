import os
os.environ['DATABASE_URL'] = 'sqlite://'
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.database import Base, engine
from app.main import app

# SQLite in-memory tests share the connection across TestClient requests.
engine.dispose()
engine.pool = StaticPool(creator=lambda: __import__('sqlite3').connect(':memory:', check_same_thread=False))

def test_document_sharing_and_permissions():
    with TestClient(app) as client:
        users = client.get('/users').json()
        alex, sam = users[0], users[1]
        a = {'X-User-Id': str(alex['id'])}
        b = {'X-User-Id': str(sam['id'])}
        created = client.post('/documents', headers=a, json={'title':'Planning'} )
        assert created.status_code == 201
        doc_id = created.json()['id']
        assert client.get(f'/documents/{doc_id}', headers=b).status_code == 403
        content = {'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'Hello','marks':[{'type':'bold'}]}]}]}
        assert client.patch(f'/documents/{doc_id}', headers=a, json={'content':content}).status_code == 200
        assert client.post(f'/documents/{doc_id}/share', headers=a, json={'email':sam['email']}).status_code == 200
        assert client.get(f'/documents/{doc_id}', headers=b).json()['content'] == content
        assert client.patch(f'/documents/{doc_id}', headers=b, json={'title':'Updated'}).status_code == 200
        assert client.delete(f'/documents/{doc_id}', headers=b).status_code == 403
        assert client.delete(f'/documents/{doc_id}/share/{sam["id"]}', headers=a).status_code == 204
        assert client.get(f'/documents/{doc_id}', headers=b).status_code == 403

def test_file_import_validation():
    with TestClient(app) as client:
        uid = client.get('/users').json()[0]['id']
        headers = {'X-User-Id':str(uid)}
        assert client.post('/documents/import', headers=headers, files={'file':('bad.pdf',b'abc')}).status_code == 415
        response = client.post('/documents/import', headers=headers, files={'file':('note.md',b'# Hello\nWorld')})
        assert response.status_code == 201
        assert response.json()['content']['content'][0]['type'] == 'heading'
