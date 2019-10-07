---
title: "Django에서 SSO하기"
category: develop
date: 2016-05-06 16:59:58
subtitle:
header-img: "/img/header_img/bg.png"
tags:
  - django
  - sso
keywords:
  - django 에서 sso 하기
---

회사에서 필요에 의해 [Single Sign On](https://ko.wikipedia.org/wiki/%ED%86%B5%ED%95%A9_%EC%9D%B8%EC%A6%9D, "Single Sign On")을 구현해야 할 일이 있었다. 3개의 독립된 사이트가 있었고, 각자 로그인을 따로 해야 한다는 점이 사용자 입장에서는 번거로운 일이 될 수 있다는 이유에서 였다.

 3개의 사이트는 하나의 유저테이블을 바라보고 있었기 때문에 충분히 합당한 이유였다. 하지만 django에서 제공하는 기본 유저 테이블을 사용하지 않기 때문에 찾아봤었던 다른 인증 툴들은 그대로 사용하기 까다로워 보였다. 내가 구현해야 하는 상황에는 몇가지 제약사항이 있었다.

1. 로그인을 시도할 때 기존에 제공되는 auth_user 테이블이 아닌 <U>별도의 user 테이블을 사용하고 있다.</U>

2. 기존에 제공되는 user 모델을 사용하지 않기 때문에 <U>reatframework 에서 기존에 제공하는 인증방식을 그대로 사용할 수 없었다.</U>

3. 이미 테이블이 존재하고 <U>django 프로젝트에서 migration 을 할 수 없는 상황이다.</U> 기존에 생성되어 있는 테이블들의 구성을 변경할 수는 있지만 그 과정과 절차가 까다롭고 (회사의 사정에 의해), 외래키를 사용하지 않았기 때문에 모델과 테이블간의 100% 싱크가 맞지 않는 상황이었다.

4. 위와 같은 이유로 찾아봤었던 [MamaCAS](https://github.com/jbittel/django-mama-cas, "MamaCas") 같은 외부 인증툴을 사용할 수 없었다. (migration을 할 수 없었기에 인증을 위해 별도의 테이블을 생성하기 까다로운 상황이었다.)

3개의 프로젝트들이 출시가 얼마 남지 않은 상황이고, 인증을 위해서 별도의 커다란 작업이 있는 것은 별로 좋은 선택이 아니였다. 물론 외부의 다른 툴들을 이용할 수도 있었지만, 단순 인증을 위해 외부툴을 사용하기엔 부담스러운 부분이 있었고, 볼륨을 크게 잡고 싶지 않았다.

여러 방법을 찾아보면서 몇가지 아이디어가 나왔었다.

1. [redis](https://redis.io/, "redis") 를 이용해서 인증 정보를 저장하는 방식

2. [jwt](https://jwt.io/, "jwt")를 이용해서 javascript 내부에서 localStorage 에 인증 정보를 저장하는 방식

3. cookie에 저장하는 방식

나는 일단 1번의 redis는 제외하기로 했다. 이미 각각의 프로젝트에서 redis를 사용하고 있었고, 인증을 위해 별도의 redis를 띄우는게 번거롭다고 생각했다. 그리고 2번의 localStorage 방식은 javascript에서 ajax통신을 각 페이지별로 날려 유효한 인증을 판단하는 방식이었는데, django 단에서 각 request마다 헤더에 인증 정보를 넣기가 까다로웠다. (하지만 jwt로 토큰을 암호화 하는건 괜찮은 방법이라 생각했다.) 3번의 cookie 방식은 별도의 작업 없이 구현이 가능했지만 3개의 사이트가 같은 메인 도메인 하에 있어야 가능했었다. 어차피 모든 사이트가 회사 내부에서 사용할 목적으로 만들어 지고 있는 프로젝트 였고 같은 메인 도메인만 사용하면 되었기 때문에 나는 3번째의 방법을 사용하기로 했다.

서론이 길었지만.. 그리하여 jwt와 cookie를 이용해서 sso를 구현해 보기로 했다.

여러 사이트가 있고 각각 로그인(유저 인증)이 필요하고 기능 마다 해당 유저가 접근할 수 있는(허가) 기능이 필요하다.

(single sign on 을 하다보니 authentication 과 permission 처리가 필요했다..)

여러 개의 사이트가 공유하는 유저 정보가 있고, 이 정보로 로그인을 하기 때문에 모든 사이트에서 한번의 로그인을 하면 되는 기능이 필요했다.추가적으로 각 사이트 별로는 각자의 허가 정보가 있으므로 이 정보는 공유하지 않고 각자 구현한다. (템플릿만 제공)

한마디로 요약하면 쿠키에 암호화된 토큰 정보를 도메인이 같은 사이트들끼리 로그인 정보를 공유를 해서 사용하는 방법이다.

## 예상 시나리오

alpha.mysite.com, beta.mysite.com, charlie.mysite.com 3개의 사이트가 있다.
beta 에서 로그인을 하고 charlie 사이트에 접속할 경우 이미 로그인이 되어 있다.
3개의 사이트는 각자 permission 이 따로 존재한다.
alpha 에서 로그아웃을 할 경우, 나머지 사이트에서도 모두 로그아웃이 된다.
로그인 정보가 만료되었을 경우에도 로그아웃 처리된다.

## 시나리오 순서 별 설명

1. 로그인 시 : <U>jwt token</U> 을 발급해서 request cookie에 저장한다. (이 때, <U>cookie</U> 의 domain은 main domain 값을 넣어준다.<mysite.com>)
2. 인증이 필요한 페이지에 접속할 경우
rest framework 의 <U>authentication</U> class 에서 cookie 에 저장되어 있는 token 값의 유효성을 검사한다.
rest framework 의 <U>permission</U> class 에서 해당 유저가 기능에 접근 허가 여부를 판단한다.
3. 로그아웃 시 : cookie 의 token 값을 지워준다.
4. 추가 정보
	* 인증에 실패한 경우 : cookie 값을 삭제하고 login 페이지로 보낸다.
	* 기능 접근 허가가 거부된 경우 : block page 를 표시한다.
	* 토큰이 만료된 경우 : cookie 값을 삭제하고 login 페이지로 보낸다.
5. 제약사항
	* 메인 도메인이 동일해야한다.
	* permission 정보는 공유하지 않기 때문에 각자 사이트에서 구현해야 한다.

## 환경 설정

```
python 3.4.3
django 1.8.4
djangorestframework 3.3.0
```

하나씩 시작해보자.

### 패키지 추가하기

```
$ pip install djangorestframework-jwt
```

### 로그인 하기

#### 토큰 생성하기

유저 정보가 맞을 경우 이 정보를 토대로 jwt token을 생성해준다.
jwt_util.py

```
from calendar import timegm
from datetime import datetime

import jwt
from rest_framework_jwt.settings import api_settings

from user.models.CustomUser import CustomUser


def obtain_token(user: CustomUser):
    jwt_payload_handler = api_settings.JWT_PAYLOAD_HANDLER
    jwt_encode_handler = api_settings.JWT_ENCODE_HANDLER

    payload = jwt_payload_handler(user)

    # Include original issued at time for a brand new token,
    # to allow token refresh
    if api_settings.JWT_ALLOW_REFRESH:
        payload['orig_iat'] = timegm(
            datetime.utcnow().utctimetuple()
        )

    return jwt_encode_handler(payload)
```

jwt 변수들에 대한 자세한 설정은 Rest Framework JWT 에서 확인 할 수 있다. 그리고 default 로 설정된 변수들을 재선언 하고 싶다면 setting 에 해주면 된다.

settings.py

```
JWT_AUTH = {
    'JWT_EXPIRATION_DELTA': datetime.timedelta(hours=24),
}
```

#### 쿠키에 저장하기

사용자가 입력한 아이디와 암호가 맞을 경우 이 정보를 cookie 에 저장을 한다. 저장할 때 domain option 을 main domain(mysite.com) 로 설정해준다. domain 설정을 해주지 않을 경우 다른 사이트에서 쿠키정보를 공유할 수 없다.


view.py

```
class LoginView(View):

    def get(self, request):
        return TemplateResponse(request, 'account/login.html')

    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        try:
            admin = CustomUser.objects.get(username=username)
            # 유저 암호 검사하기.
            if security.matches_password(password, admin.password):
                # obtain jwt token
                token = obtain_token(admin)

                # set cookie
                response = HttpResponseRedirect(reverse('root'))
                response.set_cookie(key='token', value=token, domain=settings.COOKIE_DOMAIN)
                return response
            else:
                context = {
                    'error': '비밀번호가 일치하지 않습니다.'
                }
        except TAdmin.DoesNotExist:
            context = {
                'error': '존재하지 않는 ID입니다.'
            }

        return TemplateResponse(request, 'account/login.html', context)
}
```

공통으로 사용할 메인 도메인 이름은 각 사이트 마다 통일 해줘야 한다.

settings.py

```
COOKIE_DOMAIN = 'mysite.com'
```

쿠키에 토큰 값을 저장 했으므로 이제 각 사이트에 로그인 되었다고 할 수 있는 첫번 째 단계는 달성했다.

#### 페이지 인증정보 확인하기
로그인이 되어 있어야 접근할 수 있는 페이지의 경우 로그인 정보를 확인한 후에 정보를 로드한다. RestFramework 에서 제공하는 APIView 를 사용해서 인증 정보를 확인한다.

view.py

```
class RootView(APIView):
    authentication_classes = (CustomAuthentication, )
    def get(self, request):
        """
        :param request:
        :return:
        """
        redirect_url = "/home"
        return HttpResponseRedirect(redirect_url)

}
```

 여기서 authentication class 를 명시적으로 선언해주었는데, 모든 APIView(인증과 허가가 필요한 페이지의 경우) 에 적용될 수 있도록 settings 에 선언해줄 수 있다.

(인증 실패나 허가 요청 실패시 처리해줄 수 있는 핸들러도 미리 추가해놓자.)

settings.py

```
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common.utils.authentication.CustomAuthentication',
    ),
    'EXCEPTION_HANDLER': 'common.utils.custom_exception_handler.custom_exception_handler'
}
```

인증 확인은 쿠키에 저장되어 있는 토큰 정보로 확인한다. 토큰으로 정상적인 유저를 가져올 수 있다면 유효한 유저라고 판단한다.

authentication.py

```
from rest_framework import authentication

from common.utils.jwt_util import obtain_user


class CustomAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        """
        쿠키에 저장되어 있는 token 값으로 유저를 가져옵니다. 가져오는 상황에서 예외가 발생할 수 있으며 정상적으로 가져온 경우에는 인증된 유저라고 판단합니다.
        :param request:
        :return:
        """
        token = request.COOKIES.get('token', None)
        user = obtain_user(token)
        return (user, None)
```

쿠키에 저장되어 있는 토큰을 decode 하여 유효한 정보인지를 판단한다.

jwt_util.py

```
def obtain_user(token: str):
    """
    payload = {'username': 'adm001', 'email': 'test@mysite.com', 'user_id': 1, 'exp': 1462187582}
    :param token:
    :return:
    """
    jwt_decode_handler = api_settings.JWT_DECODE_HANDLER
    jwt_get_username_from_payload = api_settings.JWT_PAYLOAD_GET_USERNAME_HANDLER

    if not token or len(token) == 0:  # case1: 토큰을 분실 했을 경우
        raise serializers.ValidationError('Invalid token header. Non credentials provided.')
        # raise exceptions.AuthenticationFailed({'error': 'Invalid token header. No credentials provided.'})

    try:
        payload = jwt_decode_handler(token)

    except jwt.ExpiredSignature:  # case2: 토큰이 만료되었을 경우
        raise serializers.ValidationError('Signature has expired.')
        # raise exceptions.AuthenticationFailed({'error': 'Signature has expired.'})
    except jwt.DecodeError:  # case3: 디코드 실패
        raise serializers.ValidationError('Error decoding signature.')
        # raise exceptions.AuthenticationFailed({'error': 'Error decoding signature.'})

    username = jwt_get_username_from_payload(payload)

    if not username:  # case4: payload 가 잘못되어 username을 가져올 수 없는 경우
        raise serializers.ValidationError('Invalid payload.')
        # raise exceptions.AuthenticationFailed({'error': 'Invalid payload.'})

    try:
        user = CustomUser.objects.get(username=username)
    except CustomUser.DoesNotExist:  # case5: 해당 유저가 존재하지 않는 경우
        raise serializers.ValidationError("User doesn't exists.")
        # raise exceptions.AuthenticationFailed({'error': "User doesn't exists."})

    return user
```

여러 이유로 인증에 실패할 경우엔 인증 실패 예외가 발생하게 되는데 이는 따로 핸들러로 처리해주어야 한다. (에러 정보는 response.data 에 담겨온다.)
(여기서는 인증 실패 예외가 발생할 경우 쿠키에 저장되어 있는 토큰값을 지워버리고 로그인 페이지로 보내버린다.)

custom_exception_handler.py

```
from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    # 발생한 exception을 가져온다.
    response = exception_handler(exc, context)

    if response is not None:
        # response_data = response.data['detail']
        # print('response : ', response.__dict__)

        # 예외가 발생할 경우엔 token쿠키를 지워준다
        response.delete_cookie('token', domain=settings.COOKIE_DOMAIN)

        return HttpResponseRedirect(reverse('login'))
    else:
        return None
```

#### 페이지 접근 허가 정보 확인하기
접근하고자 하는 페이지가 각 유저별로 인증 정보가 필요하다면 유저의 인증 정보를 확인할 수 있어야 한다.

permission.py

```
from rest_framework.permissions import BasePermission


class CustomPermission(BasePermission):
    def has_permission(self, request, view):
        # TODO: do something
        print('CustomPermission user : ', request.user)
        return True
```

(현재는 어떤 허가 정보도 판단하지 않지만 이 부분에서 유저 정보를 가지고 해당 페이지에 대한 허가 정보를 판단해서 boolean 값으로 반환해준다. True일 경우 허가된 경우고 False일 경우엔 허가되지 않는 유저이다.)

APIView 에서 허가 정보도 명시적으로 선언해서 확인할 수 있다.

view.py

```
class RootView(APIView):
    authentication_classes = (CustomAuthentication, )
    permission_classes = (CustomPermission, )
    def get(self, request):
        """
        :param request:
        :return:
        """
        redirect_url = "/home"
        return HttpResponseRedirect(redirect_url)
```

마찬가지로 모든 APIView 에서 허가 정보를 확인해야 한다면 settings 에 설정해줄 수 있다. 좀 전에 인증 정보를 작성한 부분에 추가해주자.

settings.py

```
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common.utils.authentication.CustomAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'common.utils.permission.CustomPermission',
    ),
    'EXCEPTION_HANDLER': 'common.utils.custom_exception_handler.custom_exception_handler'
}
```

허가 요청에 대한 부분이 추가되었으므로 예외 처리 핸들러에서 이 부분에 대한 처리도 추가해줘야 한다. 요청이 실패할 경우 403 에러가 발생하는데 이 부분에 대한 처리를 해준다.

custom_exception_handler.py

```
from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    # 발생한 exception을 가져온다.
    response = exception_handler(exc, context)

    if response is not None:
        # response_data = response.data['detail']
        # print('response : ', response.__dict__)

        # permission 이 안되는 경우엔 block page 로 넘겨준다.
        if response.status_code == status.HTTP_403_FORBIDDEN:
            return HttpResponseRedirect(reverse('block'))

        # 예외가 발생할 경우엔 token쿠키를 지워준다
        response.delete_cookie('token', domain=settings.COOKIE_DOMAIN)

        return HttpResponseRedirect(reverse('login'))
    else:
        return None
```

인증 실패인 경우에는 쿠키에서 토큰 정보를 삭제하고
로그인 페이지로 보내버리고,
허가 요청 거부일 경우에는 block 페이지로 보내버렸는데,
이 부분은 각 사이트의 상황에 맞게 처리해주면 된다.

#### 로그아웃 하기
로그아웃은 간단하다. 단지 쿠키에 저장되어 있는 토큰 값을 지워버리면 되기 때문이다.

view.py

```
class LogoutView(View):

    def get(self, request):
        response = HttpResponseRedirect(reverse('login'))
        response.delete_cookie('token', domain=settings.COOKIE_DOMAIN)
        return response
```

#### 요약
지금까지 추가된 파일들과 클래스를 정리하자면 다음과 같다.

```
common/utils/custom_exception_handler.py
    - custom_exception_handler
common/utils/authentication.py
    - CustomAuthentication
common/utils/permission.py
    - CustomerPermission
common/utils/jwt_util.py
    - obtain_token
    - obtain_user
```

여기까지 따라왔다면 sso를 완성 할 수 있다. 하나의 사이트에서 동작하는지 여부를 검사하고 싶다면 hosts 에 도메인을 추가해서 테스트 해보자.

```
$ sudo vim /etc/hosts
```

/etc/hosts

```
127.0.0.1   alpha.mysite.com
127.0.0.1   beta.mysite.com
```

위와 같이 추가하고 테스트를 해볼 수 있다.

## 결론

유저의 로그인 검증 후 유저 정보를 jwt 를 이용해서 토큰을 생성한 후, 이 정보는 메인 도메인으로 쿠키에 저장을 한다. 인증이 필요한 페이지의 경우 cookie 에 저장되어 있는 토큰으로 인증된 유저인지 여부를 판단한다. 이 때, 이 토큰 값이 유효하지 않을 경우엔 강제로 로그아웃 처리를 한다. jwt 토큰의 만료 시간을 주어 일정 시간이 지나면 로그인이 풀리도록 했다. 메인 도메인 하위의 3개의 사이트중 하나의 사이트에서만 로그인을 하면 나머지 두개의 사이트에서도 로그인이 되어 있다(같은 쿠키의 토큰을 사용하기 때문)


### 추신

나름 간단하게 기능을 구현하고자 했는데 로그인 정보를 저장하고 그 토큰을 처리하기 위해 여러 처리가 붙었다. 그리고 토큰 값을 만들고 검증하고 이를 인증하는 코드들을 직접 쓰다보니 조금은 번거로운 작업들이 포함되어 있는 건 사실이다.. 때로는 오픈소스를 별다른 이해 없이 기능을 사용하기 위해 가져다 쓰는 것 보다 내부 로직을 이해하고 내가 필요한 부분들만 가져다 쓰는 작업을 하면 재미있기도 하고 후에 문제가 생기거나 기능 변경이 생겼을 때 대처가 빠르다. 물론 이런 방식이 정답을 아닐지는 몰라도 덕분에 재미있는 작업을 했다는 점에 만족한다.


