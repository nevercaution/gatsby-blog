---
title: "Django orm standalone feat(docker)"
category: develop
date: 2017-06-23 21:26:55
tags:
  - python
  - django
  - orm
  - docker
keywords:
  - django standalone app
---
필요에 의해서 배치 작업을 만들어야 했다.
간단하게 python으로 만들까 했는데, 단순 cursor로 사용하지 않고 django orm 으로 만들어 보고 싶은 생각이 들었다.
이미 작업하고 있는 django project 가 있었고, 그 안에서 사용하는 모델들을 사용해서 스크립트들을 만들면 좋겠다 생각이 들었다.
이미 django 구조에 익숙한 사람이라면 편하게 사용할 수 있을거라 생각했고, 관리가 용이하다는 장점이 있다.


### 해야할 일은..
- mysql, mongo에서 데이터를 주기적으로 가져온다.
- 데이터를 가공해서 다시 mysql이나 mongo로 데이터를 주기적으로 쌓아준다.
- 여러 서버의 상황에 맞게 대응을 해야한다.(real, sandbox, test등등)

이미 사내에서 사용하고 있는 훌륭한 배치 스크립트 뭉치가 있다. 이 스크립트는 cursor를 통해서 mysql 데이터를 가져오고 넣는다.
물론 cursor로 쿼리를 작성해도 되지만 django-orm을 이용해서 이 작업을 조금 더 수월하게 할 수는 없을까? 하는 생각에 django template 를 사용하지 않고 orm 만 사용할 수 있는 프로젝트를 만들어보기로 했다.

### django-orm standalone으로 가자

일단 간단한 django 프로젝트를 하나만든다.

```
$ django-admin startproject django-orm
```

설정과 최소한의 파일들을 제외하고 모두 제거해버리자. 구조는 아래와 같다.

~~~
.
├── Dockerfile
├── build.sh
├── db
│   ├── __init__.py
│   └── models.py
├── manage.py
├── requirements.txt
├── run.sh
├── scripts
│   ├── __init__.py
│   └── test.py
└── settings.py
~~~

1. requirements.txt : 스크립트를 수행할 떄 필요한 모듈등을 기술해준다.
2. manage.py : django-extension의 runscript 나 shell 기능을 사용할 수 있도록 한다.
3. settings.py : 여러 저장소의 접속 환경이나 환경변수들을 선언해준다.

위의 구조를 뼈대로 필요한 부분을 채워서 사용하기로 한다. requirements.txt를 살펴보자.

- requirements.txt

~~~
Django==1.11.2
django-extensions==1.7.9
mysqlclient==1.3.10
pytz==2017.2
six==1.10.0
~~~

[django-extension](https://github.com/django-extensions/django-extensions) 을 사용해서 스크립트들을 돌리고, mysql 의 데이터를 사용하기 위해 둘다 설치해주었다. 각자 필요한 부분이 있다면 추가해주면 된다.
이번에는 설정파일을 보도록 하자.

- settings.py

~~~
import os

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'test',
        'USER': 'root',
        'PASSWORD': '',
        'HOST': '127.0.0.1',
        'PORT': '3306'
    },
}

INSTALLED_APPS = (
    'db',
    'django_extensions',
)

# SECURITY WARNING: Modify this secret key if using in production!
SECRET_KEY = '{your_secret_key}'

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Seoul'

USE_I18N = True

USE_L10N = True

USE_TZ = True
~~~

기본 설정파일에서 DATABASES 부분만 수정해 준 상태이고 model들이 KST로 시간을 붙어여 했기 때문에 타임존 설정을 서울로 바꾸어 주었다.
여기에서 로그에 대한 설정이나 다른 저장소에 대한 정보를 적어주면 된다.

구조를 잡았으니 추가해야할 패키지들을 설치해주도록 한다. 여기서부터는 익히 알고 있는 패턴이므로 간단하게 살펴보자.

```
$ pip install -r requiremwnts.txt
```

모델은 현재 자신의 db에 있는 테이블을 정의해주고 orm으로 붙기만 하면 된다. 모델을 한번 보자.

- model.py

~~~
from django.db import models

# Create your models here.


class User(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=11)

    class Meta:
        managed = False
        db_table = 'user'

~~~

db 설정을 해주었고 필요한 패키지를 설치했고, 모델들을 정의해주었다면 한번 붙어보자.

### hello orm

python shell 로 들어가서 모델을 통해 데이터를 가져오면 된다.

~~~
$ python manage.py shell
~~~

~~~
>>> from db.models import User
>>> User.objects.all()
<QuerySet [<User: User object>, <User: User object>, <User: User object>, <User: User object>, <User: User object>]>
~~~

모델을 통해 데이터를 가져올 수 있고, 작업해야할 부분은 스크립트를 만들어서 사용하도록 한다. 기본적인 스크립트를 하나 만들어보자.

- test.py

~~~
from db.models import User


def run(*script_args):

	user_list = User.objects.all()

	for user in user_list:
		print('name : ', user.name)
~~~

간단하다. 스크립트를 만들었으니 수행해보자. runscript 는 위에서도 언급했지만 django-extension의 기능중 하나이다.

~~~
$ python manage.py runscript test
name :  teddy
name :  canel
name :  twght
~~~

이제 필요한 스크립트를 만들어서 crontab에 걸어두면 django orm 을 이용해서 스크립트를 사용할 수 있다.
여기까지 했으면 간단하게 끝날텐데, 이 배치 스크립트를 여러 환경에 배포하고 돌려야 하는 일이 남아있었다.
물론 서버가 많지 않아 git으로 땡기거나 손으로 직접 옮겨도 되지만, 칼을 뽑은 김에 docker image 로 만들어서 써보자. 어렵지 않다.

Docker iamge 로 만드는 작업은 완전 단순하다. 사용법도 전혀 어렵지 않다. 일단 Dockerfile을 보자.

- Dockerfile

~~~
FROM python:3.5-onbuild
~~~

사족으로 [pythpn:3.5-onbuild](https://github.com/docker-library/python/blob/9a9021f2134d953165b31d98cacb95aa34076f90/3.5/onbuild/Dockerfile) 에서 하는 일은 아래와 같다.

~~~
#
# NOTE: THIS DOCKERFILE IS GENERATED VIA "update.sh"
#
# PLEASE DO NOT EDIT IT DIRECTLY.
#

FROM python:3.5

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ONBUILD COPY requirements.txt /usr/src/app/
ONBUILD RUN pip install --no-cache-dir -r requirements.txt

ONBUILD COPY . /usr/src/app
~~~

이렇게만 써주고 build 하면 끝이다.

~~~
$ docker build --tag django-orm:0.1 .
~~~

이미지를 만들었다면 다음과 같이 생성이 된다.

~~~
$ docker images
REPOSITORY            TAG                 IMAGE ID            CREATED             SIZE
django-orm            0.1                 c8a6c10c8233        About an hour ago   715 MB
~~~

이 이미지를 사용하기 위해서는 run 명령으로 사용하도록 하자.

~~~
docker run --name django-orm django-orm python manage.py runscript test
~~~

### docker로 사용할 때 신경써야할 부분이 있다면
container 내부에서는 host에 바로 접근할 수가 없기 때문에 mysql localhost 를 바라봐야 한다면 localhost 로 명시해주면 안된다.
물론 회피 방법은 조금만 구글링해도 나오지만 원칙적으로는 접근을 할 수 없으므로 이 부분을 신경써서 작업해주어야 한다.
~~나는 mysql이 다른 서버에 동작하고 있었기 떄문에 별 문제는 없었다.~~


### 결론
이미 django project 를 구동해본 경험이 있다면 큰 어려움 없이 사용할 수 있을 것이다.
물론 해당 프로젝트에서 배치 스크립트를 작성할 수도 있지만, 성격이 맞지 않을 수 있기 때문에 굳이 억지로 넣을 필요는 없다.
cursor로 작업하는게 간단하고 편할 수도 있지만, 여러 패키지를 함께 써야하고 여러 db 설정을 바라봐야 한다면 django 의 골격을 그대로 사용하는 방법이 손쉬울 수 있겠다.
해당 예제는 [django-orm standalone](https://github.com/nevercaution/django-orm) 에서 확인할 수 있다.