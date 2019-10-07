---
title: "Python에서 iOS, Android 스토어 인앱 결제 검증하기"
catalog: true
date: 2016-03-11 16:43:24
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- python
- ios
- android
- inapp
---
Django framework를 이용해서 프로젝트를 만들면서 했던 여러가지 삽질들과 넘어야했던 많은 산들과 몰랐던 부분들에 대해서 내 나름 공부 겸 기록을 위해 남겨둬야 겠다는 생각이 들었다. 프로젝트로 한창 바빴던 시기에는 당장 앞에 놓여진 일들에 치여 이런 생각을 못하고 있다가 지금은 조금 여유가 되어 그 때 있었던 일들에 대한 나름의 경험을 기록해보고자 한다.

그 중에 한가지가 인앱 아이템 결제하기 였다. 나는 예전에 cocos2d-x로 게임을 개발했던 시절엔 결제 프로세스를 클라이언트(단말기)사이드만 알고 있었고 서버사이드의 로직은 전혀 모르고 있었는데, 오히려 이번에 서버 로직을 구현하면서 그 때 그 시절의 경험이 많은 도움이 되었다. 앱 내에 아이템을 구매하고 구매한 아이템을 유저에게 잘 넣어주는 로직이야 구현방식도 다양하고 여러 기교들이 들어가 있는데 오늘은 그 중에서 나름 간단한(?) 파트인 두 플랫폼의 결제 영수증 검증 로직의 삽질 경험을 적어보고자 한다.

이번에 대응했던 클라이언트는 google play store와 iOS app store 두개의 플랫폼이다. 차례차례 훑어보자.
각 플랫폼별 스토어의 앱 등록과 각종 키발급 같은 내용은 다루지 않고 순수하게 영수증 검증만을 볼 것이다.

1. google In-app billing
구글 결제 영수증 검증의 경우 생각보다 단순해서 처음에는 이게 맞나? 싶었다. 일반적으로 생각하기에는 구글의 결제서버에 영수증 정보를 넘겨 유효한 영수증인지 여부를 판단해서 진행이 되는줄 알았는데(이렇게 하는 방법도 있다고 한다.), 훨씬 간단한 방법이 있었다. 암호화된 영수증 정보를 클라이언트로 부터 받아와서 local에서 검증하는 방식이다.

일단 pip를 이용해서 Crypto 라이브러리를 설치하도록 하자.

```
pip install pycrypto
```
 

다음은 영수증 검증 코드이다. signed_data 는 안드로이드 결제완료시 넘어온 암호화된 영수증 문자열이고 signature는 클라이언트와 약속된 특정 문자열이다. 안드로이드에서 결제를 요청할 당시 이 값을 함께 넘겨주면 signed_data 내부에 이 signature 값이 심어들어가게 되고, 복호화를 하면 이 값이 풀어져 나와 영수증 검증을 할 수 있다.

```
from base64 import b64decode
from Crypto.Hash import SHA
from Crypto.PublicKey import RSA
from Crypto.Signature import PKCS1_v1_5

# Your base64 encoded public key from Google Play.
PUBLIC_KEY_BASE64 = 'YOUR_PUBLIC_KEY_BASE64'

def verify_for_google(signed_data, signature):
    """Returns whether the given data was signed with the private key."""
    key = RSA.importKey(_pem_format(PUBLIC_KEY_BASE64))
    verifier = PKCS1_v1_5.new(key)
    data = SHA.new(signed_data.encode('utf8'))
    sig = b64decode(signature)

    return verifier.verify(data, sig)


def _pem_format(key):
    return '\n'.join([
        '-----BEGIN PUBLIC KEY-----',
        '\n'.join(_chunks(key, 64)),
        '-----END PUBLIC KEY-----'
    ])


def _chunks(s, n):
    for start in range(0, len(s), n):
        yield s[start:start+n]
```


먼저 스토어에서 발급받은 공개키가 필요하다. 이 키를 이용해 넘어온 데이터가 유효한지 여부를 판단할 수 있다.
1. RSA 암호 방식으로 암호화가 되어 있기 때문에 PUBLIC KEY 를 이용해 key객체를 생성한다.
2. PKCS(Public Key Cryptography Standard)를 이용해서 암호화된 영수증을 검증 할것이다. 1번에서 만들어진 key를 이용해 verifier 객체를 생성하자.
3. SHA(Secure Hash Algorithm)으로 된 signed_data를 객체로 생성한다.
4. signature 를 decode 한다.
5. 2번에서 생성한 verifier를 통해 data 와 sig 의 유효성을 판단한다. 유효한 영수증은 True 그렇지 않으면 False 를 반환한다.
이 부분에 대해서는 좀 더 공부가 필요해 보인다.. 현재는 암호화에 대한 꼭지들이 의미하는 바를 인지해야겠지만 이들이 어떤 작업을 하는지에 대한 공부도 반드시 필요할 것이다.
코드 내용이 그리 간단하지는 않지만 비교적 빠르게 구글 영수증 검증을 할 수 있었다. 구글의 개발자 사이트를 들어가 이런 저런 글도 읽오보고 여러 포스팅을 찾아보면서 여러가지 자료를 봐왔었는데 stackoverflow 에서 찾은 글들을 추려 간단하게 메소드로 정리했다. 내가 여기서 삽질 했던 부분은 대체 signed_data 와 signature 가 무엇을 뜻하는지 알 수가 없었다는 점이였다. 대부분의 자료들에서는 저 둘이 무엇을 의미하는지 자세히 기술을 해놓지 않거나 아예 어떤 값을 의미하는지를 써놓지 않은 글들이 많았다. 나도 처음에는 이리저리 고민을 해보다가 일단 맨땅에 헤딩을 하고보자는 마음으로 여러 땅에 삽집을 하다가 찾은 결과물이다.


2. iOS in-app purchase
이번에는 iOS결제 영수증 검증을 해보도록 하자. apple은 구글과는 다르게 결제 서버에 영수증을 보내서 넘어온 값을 통해 영수증의 유효성을 판단한다. 직접 apple의 결제 api를 호출해서 검증을 해도 되지만 역시나 Python은 있을만하다고 생각하는 라이브러리는 이미 존재하거나 누군가가 만들어 놨다. 우리는 이 라이브러리를 만든분 께 감사를 드리며 코드를 받아가도록 하자.

```
pip install itunes-iap
```

itunes-iap를 설치하면 의존성 라이브러리들이 이것저것 왕창 설치된다. 궁금하면 ($pip list 를 통해 확인해볼것)
이번에는 iOS 영수증 검증 코드를 보도록 하자. 이 때 transaction_id 는 결제 당시 결과값으로 오는 구매 영수증 id이고, raw_data는 암호화된 영수증 문자열이다. 

```
import itunesiap

def _verify_for_ios(transaction_id: str, raw_data: str):
    """
    seeAlso : https://developer.apple.com/library/ios/releasenotes/General/ValidateAppStoreReceipt/Chapters/ValidateRemotely.html
    :param transaction_id: 결제 transaction_id
    :param raw_data: base64-encoded data
    :return: boolean
    :raises: Otherwise raise a request exception (RuntimeError, itunesiap.exc.InvalidReceipt)
    """
    try:
        # for sandbox environment.
        #     with itunesiap.env.sandbox:
        #         response = itunesiap.verify(raw_data)

        # for production environment. (default)
        response = itunesiap.verify(raw_data)  # base64-encoded data

        def _get_key(re):
            """ 영수증리스트에서 비교 키를 반환합니다. """
            return re.purchase_date_ms

        # 넘어온 in_app 영수증 리스트에서 구매 시각이 가장 마지막인 영수증을 가져와서 transaction_id를 비교한다.
        # 오름 차순으로 정렬해서 구매시각이 가장 마지막 영수증을 가져옵니다.
        receipts = sorted(response.receipt.in_app, key=_get_key)
        last_receipt = receipts[len(receipts) - 1]
        if last_receipt.transaction_id != transaction_id:
            #  구매시각이 가장 마지막인 영수증의 transaction_id 가 일치 하지 않는다.
            return False

        return response.status == 0
```

iOS 영수증 유효성 검증은 간단하다. itunesiap.verify 메소드를 통해 iOS에서 넘어온 데이터를 넣고 호출하면 복호화된 영수증 데이터가 나온다. 이 때 status 값이 0 이라면 유효한 영수증이라고 판단한다. 뭔가 apple다운 api라고 생각한다. 처음 iOS영수증 검증을 할 당시엔 verify 메소드만 호출하고 그 뒤에 넘어온 데이터의 status 값만 확인하고 유효성을 검증했다. 
여기서 나의 삽질이 시작되었다. 

1. 일단 주석에서 보는것과 같이 sandbox환경과 real환경일 때에 호출하는 api가 다르다. itunesiap의 환경을 설정을 해주는 방법은 여러가지가 있다. 각자 개발환경에서 영수증 유효성을 검사할 때엔 sandbox와 real환경을 잘 구분해서 api를 호출해주도록 하자. 아무리 유효한 영수증이라 할지라도 틀린 환경의 api를 호출하면 유효하지 않다고 판단하기 때문이다. 

2. 보통 verify 메소드를 호출하면 receipt 값 안에 하나의 영수증 정보만 가져온다. 하지만 특정 상황의 경우 receipt 데이터 안에 1개 이상의 영수증 정보가 딸려 오는 경우가 있다. 이 때에 한가지 데이터만이 유효한 영수증 값이다. 이 중에서 한가지 영수증만을 가지고 검증을 해야 하는데 여러 삽질 후에 깨달은 바는 receipt 안의 데이터들의 purchase_date_ms 값을 이용해 가장 마지막에 결제된 영수증 정보가 파라메터로 넘어온 transaction_id 와 동일하다는 점을 알게 되었다. 그래서 _get_key 메소드를 통해 receipt 리스트를 정렬하고, 그 중에 가장 마지막 영수증 정보를 뽑아 transaction_id 가 같은지 여부를 판단한다. 

자 이제 우리는 python을 이용해서 android, iOS의 영수증을 검증할 수 있게 되었다. 간단하지도 복잡하지도 않고, 몰랐을 때는 어려워 난해했지만 알고나니 더 난해한 비교적 간단하게 할 수 있는 파트였다. 이제 어디가서 이 두 플랫폼의 결제 영수증쯤은 아무렇지도 않게 검증 할 수 있다고 당당히 얘기하자.


