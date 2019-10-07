---
title: "Django에서 ajax요청하기"
catalog: true
date: 2016-03-27 16:08:12
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- django
- ajax
---
View에서 get, post요청을 할 때 template단에서 ajax요청을 날려야할 때가 있다.
APIVIew, View 두개의 경우를 살펴보자.
1.APIView ↔ ajax (post, get)
(post의 케이스로 설명을 하였지만 get도 동일한 방식이다.)
가장 빈번하게 사용하는 케이스이다. template 에서 버튼을 눌러 요청을 ajax로 날려 결과값을 받아와서 전체 화면을 다시 그리지 않고 필요한 부분만 갱신해줄 수 있다.

- template.html

~~~
$.ajax({
    url: "{% url 'request:url' %}",
    type: 'POST',
    data: {
        'user_id': user_id
    },
    success: function (response) {
        // TODO: do something.
    },
    error: function (err) {
        console.log(err);
    }
});
~~~



- url.py

 ```
url(r'^request/url$', views.TestView.as_view(), name='url'),
  ```

- view.py

``` 
class TestView(APIView):
    def post(self, request):
        user_id = request.POST.get('user_id')
      # do something
       return Response()
```
  
  
View class를 상속받고 post 메소드로 받는다면 ajax 요청시 csrf 토큰이 없다고 하면서 403에러가 발생한다.
이를 해결해주기 위해 APIView를 상속받아서 처리하면 csrf 인증을 피해갈 수 있다.  (피해간다기보단 이미 인증이 되어있는 요청이라고 판단하는 것이지만)
이는 APIView의 as_view() 메소드를 보면 알 수 있는데

- api_view.py

```
def as_view(cls, **initkwargs):
    """
    Store the original class on the view function.
 
    This allows us to discover information about the view when we do URL
    reverse lookups.  Used for breadcrumb generation.
    """
    if isinstance(getattr(cls, 'queryset', None), models.query.QuerySet):
        def force_evaluation():
            raise RuntimeError(
                'Do not evaluate the `.queryset` attribute directly, '
                'as the result will be cached and reused between requests. '
                'Use `.all()` or call `.get_queryset()` instead.'
            )
        cls.queryset._fetch_all = force_evaluation
        cls.queryset._result_iter = force_evaluation  # Django <= 1.5
 
    view = super(APIView, cls).as_view(**initkwargs)
    view.cls = cls
 
    # Note: session based authentication is explicitly CSRF validated,
    # all other authentication is CSRF exempt.
    return csrf_exempt(view)
```

마지막 라인에 csrf_exempt로 view를 감싸준다. 이는 해당 API요청이 csrf 인증이 되어있다고 명시해주는 것이다.
그리고, 내부로 파고 들어가면  APIView에서 authentication_classes = api_settings.DEFAULT_AUTHENTICATION_CLASSES 로 설정이 되어있는데, restframework의 setting을 살펴보면 아래와 같이 정의가 되어있음을 알 수 있다.
  
- api_settings.py

```
'DEFAULT_AUTHENTICATION_CLASSES': (
    'rest_framework.authentication.SessionAuthentication',
    'rest_framework.authentication.BasicAuthentication'
),
  
# Authentication
'UNAUTHENTICATED_USER': 'django.contrib.auth.models.AnonymousUser',
'UNAUTHENTICATED_TOKEN': None,
```

인증 처리를 rest_framework의 SessionAuthentication으로 하겠다는 내용과 인증 유저를 AnonymousUser 로 설정을 해준다.
기존의 인증절차에서 default인증 객체를 검사하게 되는데, 이 때 user객체의 active를 검사할 때 이 객체가 유효하지 않으면 unauthenticated_user로 AnonymousUser객체를 생성하게 된다. 접근 허용 체크를 할 때는 APIView에 정의된 permission class로 체크를 하는데 아래와 같다.
  
- api_settings.py

``` 
'DEFAULT_PERMISSION_CLASSES': (
    'rest_framework.permissions.AllowAny',
),
```

AllowAny Class는 permission요청에 대해 무조건 True를 반환해주므로, APIView의 check_permissions 메소드에서 권한 체크를 할 때 권한이 있다고 판단을 한다.
  
- permissions.py

``` 
class AllowAny(BasePermission):
    """
    Allow any access.
    This isn't strictly required, since you could use an empty
    permission_classes list, but it's useful because it makes the intention
    more explicit.
    """
    def has_permission(self, request, view):
        return True
```
 
즉, APIView는 기존의 django 에서 체크하고 있는 csrf 공격방어에 대한 인증을 제외하고 따로 인증절차를 진행하게되는데, 인증 유저를 익명유저로 설정하여 유저에 대한 권한검사를 하지 않고 default로 설정이 된 권한체크 클래스로 검사를 한다.
AllowAny는 접근 허용여부를 모두 True로 반환하여 접근에 대해 유효하다고 판단하여 csrf토큰 없이 요청 수행이 가능한 것이다.
데이터를 모두 처리하고 나서의 응답값은 Response 객체를 반환함으로서 처리한다.

2.View ↔ ajax (post, get)
ajax를 통해 View class에 메소드를 호출하는 경우는 많지는 않았는데, 이유는 굳이 ajax로 호출하지 않아도 할 수 있는 방법들이 있었기 때문이었다.
하지만 종종 사용해야할 경우가 있었는데, 이를테면 내부 검색창에서 검색결과를 내부 포멧에 맞게 내용을 채워줘야 하는데 그 template가 별도의 파일로 있는 경우였다.
  
  
- template.html

~~~
$("#searchFrom").submit(function () {
    var user_id = $("input[name=user_id]").val();
 
    $.ajax({
        url: "{% url 'user:search' %}",
        type: "POST",
        data: {
            "csrfmiddlewaretoken": "\{\{ csrf_token \}\}",
            'user_id': user_id,
        },
        success: function (response) {
            $('#user_list tbody').html(response);
        },
        error: function (err) {
            console.log(err);
        }
    });
 
    return false;
});
~~~

{% raw %}
위의 tempalate에서 입력받은 데이터를 통해 ajax로 호출을 한다. 이 때 호출되는 class는 View를 상속받은 class 이다. form의 submit으로 호출을 한 경우인데 form에 {% csrf_token %}이 들어가있기 때문에 post요청을 날릴 경우엔 403이 떨어진다.(get요청은 안넣어도 상관없다.)
이런 경우를 방지하기 위해 data필드에 csrf token 을 넣어준다.
{% endraw %}

~~~
"csrfmiddlewaretoken": "{{ csrf_token }}",
~~~

요청을 받고 데이터를 만들고 나면 TemplateResponse를 사용하여 분리되어 생성된 페이지를 반환하게 된다. 
  
- view.py

```
class UserSearchView(View):
    def post(self, request):
        user_id = request.POST.get('user_id')
        user_list = service.search_user(user_id)
        context = {
            'user_list': user_list
        }
        return TemplateResponse(request, 'user/user_list.html', context)
```

다시 template에서는 넘어온 html덩어리를 미리 정의해둔 위치에 그대로 붙여줌으로서 화면을 다시 그리지 않고, 필요한 부분만 넣어줄 수 있다. 
(APIView등을 통해 데이터만 받아와 다시 그리는 방법도 있지만 성격이 맞지 않는다고 생각하였고, 일반 호출을 하게 되면 페이지로딩을 다시 하므로 그 방법은 피했다)


