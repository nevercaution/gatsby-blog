---
title: "spring boot 에서 jsp view 만들기 (feat freemarker)"
catalog: true
date: 2018-02-22 11:33:19
subtitle:
header-img: "/img/header_img/bg.png"
tags:
- springboot
- jsp
- freemarker
- gradle
---

### view를 추가해야한다.  

spring 을 사용하다가 spring boot 로 넘어오면서 front, back 을 나누어서 백단은 나름 Restful 하게 해서 api 콜만 처리하는 방식으로 변경하는 중이다.(front 는 react로 구성하는 중이다.) 그래서 spring boot 에서는 따로 view 처리해야할 일이 없었는데 기존에 spring 에서 view 처리를 해주는 요청을 가져와야 할일이 생겼다.  
하지만 찾아보니 기존에 spring 에서 하던 방법으로는 안될 것 같다.  
왜냐하면 [spring boot 에서는 jar 로 사용할 때는 jsp를 사용할 수 없다고 한다.](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-developing-web-applications.html#boot-features-jsp-limitations)  
내용을 읽어보니 boot에 내장 tomcat에 하드코딩 패턴때문에 jar형식으로는 webapp내용을 가져올 수 없다고 한다. 그리고 공식적으로 jsp를 지원하지 않는다고 한다. boot에서 밀고 있는 template engine 들이 여러개 있었는데 간단한 view 하나 추가하는데 공수가 많이 들게되면 좋지 않을꺼라 생각해서 jsp로 view 를 구성하는 방법을 시도해보았다.  
일단 작업을 시작하기 전에 현재 사용하고 있는 버전들을 정리하고 간다.  

### 사용하고 있는 버전은 다음과 같다.
* spring boot 1.5.7
* gradle 4.4  

### 나중에는 없어질 view 이지만
front작업이 react로 완료되면 이 view 는 더이상 필요하지 않다.  
그래서 나는 최소한의 공수로 기존에 있는 jsp 파일을 사용하여 가볍게 포팅만 하고자 했다.  

--- 

## 1차 시도
spring boot 에서 jsp view를 사용하기 위해 spring에서 구성하는 방법과 추가적으로 필요한 설정들을 해주었다.  
spring boot 의 내장 tomcat에는 jsp parser가 없기 때문에 의존 패키지를 추가해주어야 한다.  

- build.gradle  

```bash
derendencies {
    compile('javax.servlet:jstl')
    compile("org.apache.tomcat.embed:tomcat-embed-jasper")
}
```
  
그리고 구조는 아래와 같이 구성했다. main밑에 webapp폴더를 추가해서 jsp파일을 추가해준다.  

```bash
.
├── build.gradle
├── gradlew
├── gradlew.bat
└── src
    ├── main
    │   ├── java
    │   │   └── com
    │   │       └── example
    │   │           └── demo
    │   │               ├── DemoApplication.java
    │   │               └── MyController.java
    │   ├── resources
    │   │   └── application.properties
    │   └── webapp
    │       └── WEB-INF
    │           └── jsp
    │               └── index.jsp
    └── test
```
  
spring boot 는 webapp의 위치를 모르기 때문에 설정파일에 경로를 명시해주어야 한다.  
* application.properties  
  
```bash
spring.mvc.view.prefix=/WEB-INF/jsp/
spring.mvc.view.suffix=.jsp
```
  
설정은 다했다. 이제 controller에서 view를 호출해보자.  
* MyController.java  

```java
package com.example.demo;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.ModelAndView;

@Controller
public class MyController {

    @RequestMapping(value = "/")
    public ModelAndView main() {
        ModelAndView view = new ModelAndView("index");
        view.addObject("text", "world");
        return view;
    }
}
```
설정파일에서 prefix, suffix를 적어주었기 때문에 view이름은 파일이름만 넣어주면 된다.  

* index.jsp

```html
<html>
    <body>
        <h1>Hello world</h1>
        hello ${text}
    </body>
</html>
```
이제 bootRun 을 하면 build 를 하고 테스트를 해볼 수 있다.  

```bash
$ ./gradlew clean bootRun
:compileJava 
:processResources 
:classes 
:findMainClass
:bootRun
```

* localhost:8080/
```html
Hello world

hello world
```

build 명령어로 jar파일을 만들어 보자. 
```sh
$ ./gradlew clean build
:compileJava 
:processResources 
:classes 
:findMainClass
:jar
:bootRepackage
:assemble
:compileTestJava 
:processTestResources NO-SOURCE
:testClasses 
:test 
:check 
:build

BUILD SUCCESSFUL

Total time: 1.494 secs
```

`./build/libs/testGradle-0.0.1-SNAPSHOT.jar` 에 jar가 만들어졌다. 이걸로 직접 띄워서 호출해보자.  

```bash
$ java -jar build/libs/testGradle-0.0.1-SNAPSHOT.jar
```
잘 뜨는 것을 확인 할 수 있다. 그런데 더이상 boot진영에서도 jsp파일을 그대로 쓰는걸 권장하고 있지 않으니 그냥 추천해주는 template engine로 넘어가야겠다는 생각이 들었다.  

## 2차 시도
찾아보니 정말 [여러가지 template engine]("http://www.baeldung.com/spring-template-engines")들이 있었다. 곰곰히 찾아보다 간단해 보이는 [Free Marker]("https://freemarker.apache.org/")를 써보기로 했다.  
설정을 추가해주는 것도 간단하다. 추가를 해보자.  
  
* build.gradle
  
```bash
dependencies {
    compile('org.springframework.boot:spring-boot-starter-freemarker')
}
```

그리고 jsp로 인한 설정들을 모두 제거해준다.  
* application.properties

```bash
#spring.mvc.view.prefix=/WEB-INF/jsp/
#spring.mvc.view.suffix=.jsp
```

그리고 free marker 의 확장자는 `.ftl` 이다. 기본적인 파일 위치는 `resources/templates/` 이다.  
이에 따라 파일명을 수정해주고 이동까지 하면 아래와 같이 된다.  

```bash
.
├── build.gradle
├── gradle
│   └── wrapper
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew
├── gradlew.bat
└── src
    ├── main
    │   ├── java
    │   │   └── com
    │   │       └── example
    │   │           └── demo
    │   │               ├── DemoApplication.java
    │   │               └── MyController.java
    │   └── resources
    │       ├── application.properties
    │       └── templates
    │           └── index.ftl
    └── test
        └── java
            └── com
                └── example
                    └── demo
                        └── DemoApplicationTests.java
```

위와 같이 설정하고 빌드를 하고 jar파일을 띄워주면 1차시도와 동일한 결과가 나온다.  
처음에는 jsp파일을 가지고 어떻게든 띄워보려고 노력했지만 다른 template engine을 보니 복잡한 jsp파일이 아니라면 굳이 사용하지 않아도 될거라는 생각이 들었다.  

## 결론
아무래도 이제는 spring boot를 사용하면서 jsp를 사용하기는 어려울듯 싶다. 나도 결국에는 다른 template engine을 사용했는데 설정부터 적용이 너무 편해진 느낌.  
각 template engine마다 문법이 조금 달라서 개인의 기호에 맞게 써야겠다만..(예전에 node를 할 때 [jade]("https://www.npmjs.com/package/jade")같은 경우엔 적잖은 충격을 받았었다.)  
아무래도 아직까지는 html친화적인 문법이 조금은 더 익숙한 느낌이다.  