---
title: Spring Boot Actuator 를 이용해 버전 정보 제공하기
catalog: true
date: 2018-03-24 15:23:14
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- springboot
- gradle
- spring-boot-actuator
---

### 지금 dev 서버에 배포되어 있는 서버 버전이 몇인가요?
회사에 서버환경은 dev, sandbox, test, beta, alpha, real 으로 나뉘어 있다. 각 단계별로 기능 테스트를 하고 QA를 통해 모든 기능이 개발 완료 되고 QA도 끝나면 real 서버에 배포가 된다.  
나와 클라이언트 개발자는 먼저 dev 서버에서 새로운 기능이나 버그 수정등을 테스트 하는데 일정에 쫓길 때는 메이져 버전과 마이너 버전이 동시에 작업되서 두개의 버전을 두고 개발해야 하는 상황이 생기기도 한다.  
젠킨스를 통해 해당 서버에 어플리케이션을 배포하는데 지금까지는 배포된 버전을 보기 위해선 젠킨스의 배포이력을 찾아 배포된 버전을 찾았어야 했었다. 여간 귀찮은 일이 아닐 수가 없다. 하지만 이 방법밖에는 없으니 얼른 클라이언트 개발자에게 현재 배포된 버전을 찾아서 알려주자.    
`build.gradle` 에 배포된 버전을 명시해놓고 있긴 하지만 jar로 묶인 패키지에는 버전을 알 수 있는 방법이 없다. 이런 설정정보들을 쉽게 확인할 수 있었으면 좋겠다.  

### 지금 필요한 기능과 제약을 정리해보자.  
처음엔 무작정 덤벼들까도 했지만 침착하게 숨을 고르고 내가 해야할 일을 정리해보았다.    
* 배포되는 서버환경별로 어플리케이션의 버전정보를 알고 싶다.  
* 알기 쉽게 endpoint등의 방법으로 버전을 알려주고 싶다.  
* 모듈이 여러개가 있기 때문에 현재 돌아가고 있는 어플리케이션의 이름정보등 여러가지를 알고 싶다.  

## 프로젝트의 구조를 살펴보자
spring-boot 로 구성된 프로젝트는 여러개의 모듈로 구성되어 있다. 각 프로젝트별로 기능들을 모아놓고 있으며 jar로 묶여 runnable한 모듈도 있고 common 이나 utils 같이 기능들을 모아놓은 모듈도 있다.  
프로젝트의 설정은 아래와 같이 구성되어 있다.  

```
├── README.md
├── api
│   ├── README.md
│   ├── build.gradle
│   └── src
├── batch
│   ├── build.gradle
│   └── src
├── build.gradle
├── common
│   ├── build.gradle
│   └── src
├── elasticsearch
│   ├── build.gradle
│   └── src
├── gradle
│   └── wrapper
├── gradlew
├── gradlew.bat
├── mongodb
│   ├── build.gradle
│   └── src
├── mysql
│   ├── build
│   ├── build.gradle
│   └── src
├── redis
│   ├── build.gradle
│   └── src
├── settings.gradle
└── utils
    ├── build.gradle
    └── src

```
runnable한 모듈들의 `build.gradle` 에는 각자 버전들이 명시되어 있다. `api` 모듈의 `build.gradle`을 살펴보자.  

```gradle
apply plugin: 'rebel'
apply plugin: 'org.springframework.boot'

ext {
    baseName = 'api'
    version = '9.2.8-SNAPSHOT'
}

dependencies {
    compile project(':common')
    compile project(':mysql')
    compile project(':mongodb')
    compile project(':redis')
    compile project(':utils')
    compile project(':elasticsearch')

	...
}

bootRun {
    systemProperties System.properties
}
```

`ext` 안에 모듈의 이름과 관리되고 있는 버전의 정보가 들어있다. 어떤 기능이 개발되어 질 때는 버전을 먼저 따고 그 버전에 기능들 개발해 넣게 된다. 클라이언트 개발자들과의 소통은 저 버전으로 하게 된다.  
하지만 빌드를 하면 저 정보는 jar에 따라 오지 않기 때문에 jar파일만 가지고는 버전정보를 알 수가 없다.  
안되는게 어디있는가 이제부터 저 정보들을 제공하는 방법들을 알아보도록 하자.  


## Spring boot actuator

spring boot 에서 제공하고 있는 공식 모듈중에 [spring boot actuator](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#production-ready) 라는 모듈이 있다. 이게 무엇인고 하고 살펴보니 아래와 같이 정의가 되어 있다.  

```
Definition of Actuator

An actuator is a manufacturing term that refers to a mechanical device for moving or controlling something.   
Actuators can generate a large amount of motion from a small change.
```

여러 정보들을 작은 작업으로 제공해준다니 내가 찾고 있던 것이 틀림없다. 기본적으로 여러 endpoint 들을 제공하고 있고 info 뿐만 아니라 health 나 metrics 등 여러 기능들을 제공하고 있다. 지금 필요한건 버전에 대한 정보들만 표시할 수있으면 되기 때문에 옆길로 새지말고 직진하도록 하자.  
아무런 설정을 하고 않고 빌드를 하게 되면 build.gradle 에 명시되어 있는 버전 정보들은 빠지고 빌드가 되게 된다. actuator 을 추가해보자.   
  
`build.gradle`  

```

// 1 
ext {
   baseName = 'api'
   version = '9.2.8-SNAPSHOT'
}

dependencies {
	...
	// 2
	compile 'org.springframework.boot:spring-boot-starter-actuator'
}

// 3
springBoot{
    buildInfo {
        additionalProperties = [
                'version': "${project.ext.version}",
                'name': "${project.ext.baseName}"
        ]
    }
}
```
1. `ext`에는 해당 모듈의 이름과 버전 정보가 들어가게 된다. 클라이언트와 QA가 원하는 값은 저 버전 정보이다.   
2. 모듈을 추가만 해주면 끝이다. 이제 여러 정보들을 endpoint 로 제공받을 수 있다. 하지만 이번 포스팅에서는 다른 기능들을 알아보는건 스킵하도록 한다. (조금 써보았는데 굉장히 많은 정보들을 제공해주고 있다. 나중에 좀 더 깊게 살펴보는게 좋겠다.)   
3. [buildInfo](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#howto-build-info) 값을 넣어주면 gradle 로 빌드할 때 기본적인 빌드 정보들을 `build-info.properties` 파일 안에 적어주는데 추가적인 정보들을 넣어줄 수 있다.  

이제 빌드를 해서 결과값을 살펴보자. `build/resources/main/META-INF/build-info.properties` 안에 buildInfo의 기본적인 값들과 추가적으로 기술해준 정보들이 아래와 같이 들어가있다.  

`build-info.properties`  

```
#Properties
#Sat Mar 24 16:17:58 KST 2018
build.time=2018-03-24T16\:17\:58+0900
build.artifact=api
build.group=teddy
build.name=api
build.version=9.2.8
```

### dev 서버에 배포된 버전은 9.2.8입니다.

값이 잘 들어와있음을 확인했다. 이제 actuator에서 제공하는 endpoint `info`로 이 값들을 확인할 수 있다.  

```shell
$ > curl localhost:8080/info
{
	"build":{
		"version":"9.2.8-SNAPSHOT",
		"artifact":"teddy",
		"name":"api",
		"group":"com.nevercaution",
		"time":1521877296000
	}
}
```

설정과 적용이 완료 되었다. 이제 어느 누가 서버의 버전을 묻는다면 버벅이지 말고 자신있게 버전을 알려주도록 하자.  


## 결론
요즘 [spring boot reference guide](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#production-ready) 를 읽고 있는데 개인적인 느낌으로는 [django document](https://docs.djangoproject.com/en/2.0/) 보다 훨씬 상세하고 직관적으로 문서를 작성해놓았다고 생각한다. ~~django문서보면서 추상적인 표현에 적잖이 당황했었다~~  
그리고 spring boot starter 에 많은 기능들이 있어 따로 작업해야 하는 부분이 줄어들었고 적용도 간단히 된다.  
조금 뜬금없는 생각이지만 spring boot 모듈을 한번쯤은 만들어 봐야 겠다는 생각이 들었다.  







