---
title: Spring boot 에서 gradle 에 정의되어있는 정보 가져오기
category: develop
date: 2018-05-20 17:07:49
tags:
  - gradle
  - springboot
  - logging
keywords:
  - spring boot git 정보
---

### 버전을 알고 싶다
사내에서 서비스 하고 있는 프로젝트에서 버그가 발견되었다. 그런데 이 버그는 원래는 없었는데 어느 순간부터 갑자기 등장했다. 그렇다면 어느 순간에 추가된 코드에 내재되어 있는 버그라는 이야기 인데 이를 추적하기 위해서는 커밋 로그를 모두 찾아야 한다. 로그에 버전 정보를 심을 수 있다면 특정 버전부터 발생했는지 여부를 쉽게 알 수 있을 것이다. 버전은 하루에도 몇번씩 올라갈 수 있기 때문에 버그가 발생한 최초 버전을 파악할 수 있으면 좀 더 유연한 대처가 가능하겠다.

### 더 많은 정보를 알 수는 없을까?
사내에서 사용하고 있는 spring-boot proejct 는 multi project 로써 사용하고 있고 각 팀별로 module name 을 갖고 있다. 특정 모듈들은 공통으로 사용하고 있기 때문에 (mysql, util, redis 등) 내가 쏘아올린 작은 공이 언제 어느 프로젝트에서 영향을 줄지 금방 파악하기 힘들다. 이전에 작성했던 [ Spring-boot Actuator 포스팅](https://nevercaution.github.io/2018/03/24/spring-boot-actuator/) 을 이용해 git 정보를 특정 endpoint 로 제공하는 기능을 만들어서 사내에서 유용하게 사용하고 있는데, 이와같이 각 팀별로 사용하고 있는 프로젝트에 정보들을 내가 마음대로 사용할 수 있으면 좋을 것 같다.

### Gradle ext info
우리는 내부적으로 약속된 값을 통해 각 팀별로 특정 정보들을 사용한다.

`build.gradle`

```
ext {
    appVersion = '1.0.1-SNAPSHOT'
    projectName = "teddy.bear"
}
```
사내에서 장애 알림은 [sentry](https://sentry.io/) 를 사용하는데, 어떤 에러가 발생했을 때 현재 배포되어 있는 버전을 함께 표시해주면 해당 에러가 어떤 버전에서 최초 발생했는지 추적이 가능하다. (장애상황에서도 활용이 가능하지만 필요에 따라 gradle 의 정보를 마음대로 사용할 수 있으면 상황에 따라 장점이 있다고 생각한다.)

### Shut up and code
공식문서의 [Automatic Property Expansion Using Gradle](https://docs.spring.io/spring-boot/docs/current/reference/html/howto-properties-and-configuration.html#howto-automatic-expansion-gradle) 부분을 참고해서 만들었다. 잘 동작한다. :)
`build.gradle` 에 정의되어 있는 값들을 사용하기 위해선 다음과 같이 설정해주면 된다. 공식문서에서 주석을 달아놓은 부분이 있는데, `SimpleTemplateEngine` 에서는 `$` 를 파싱하는 부분에서 충돌이 발생할 수 있어 별도의 처리를 해야 한다고 명시되어 있다. 참고로 이 부분에서 실제 프로젝트에 적용시킬 때 문제가 조금 있었는데, 단순히 `expand(project.properties)` 만 하게 되면 모든 설정파일을 가져가게 된다. 파일들에 `$` 를 사용했다면 파싱을 하다가 깨질 수 있으니 escape 처리를 해주어야 하는데, 현재 상황은 내가 필요한 설정 파일만 가져가면 되기 때문에 내가 원하는 파일들만 expand 하도록 하자. 별도의 처리를 하지 않으면 에러를 내며 `processResources` 에서 작업이 멈춘다.

```bash
:processResources FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':processResources'.
> Could not copy file '/path/to/file/error.ftl' to '/path/to/file/build/resources/main/error.ftl'.
```

`filesMatching` 로 원하는 파일 포멧만 하도록 감싸주자. (실제 이 부분에서 적용하다가 에러를 발생해서 모든 `$` 에 escape 처리를 할까 하다가 그건 좀 아닌것 같아 아래와 같이 처리했다.)

`build.gradle`

```
processResources {
    filesMatching('**/application.yml') {
        expand(project.properties)
    }
}
```

`application.yml`

```yml
ext.appVersion: ${ext.appVersion}
ext.projectName: ${ext.projectName}
```

`Info.class`

```java
@Value("${ext.appVersion}")
private String appVersion;

@Value("${ext.projectName}")
private String projectName;
```

```bash
$ curl localhost:8081/main

project name : teddy.bear, version : 1.0.1-SNAPSHOT
```

설정과 사용방법은 간단하다. 그렇다면 어떻게 이게 가능한지 조금만 더 살펴보자.
핵심은 `build.gradle` 에서 명시해준 `expand(project.properties)` 의 동작인데 build 를 하게 되면 다음의 동작을 수행한다.

```bash
$ ./build
Executing task 'build'...

:bootBuildInfo
:compileJava
:processResources   <- here!
:classes
:bootJar
:jar SKIPPED
:assemble
:compileTestJava
:processTestResources NO-SOURCE
:testClasses
:test
:check
:build
```
빌드 동작에서 컴파일을 하고 resources 파일들을 말아서(?) 만들어 주는데, `application.xml` 에 명시 되어 있는 `ext` 관련 값들의 매핑을 시켜줄 때 `gradle` 에 명시 되어 있는 값들로 채워준다. 빌드가 완료된 후 `build/resources/main/application.xml` 파일을 보면 매핑된 값들로 채워져 있는 것을 볼 수 있다.

`application.xml`

```xml
ext.appVersion: 1.0.1-SNAPSHOT
ext.projectName: teddy.bear
```

저 위에서 작성한 코드가 위와 같이 바뀌어 있음을 확인할 수 있다.


### 결론
구글링을 조금 해보니 gradle 의 명시되어 있는 정보들을 다양하게 활용할 수 있었다. 회사에서 급한 마음에 이리저리 해볼 때는 잘 안되더니 카페에 와 여유롭게 마음 잡고 해봐야지 했더니 30분만에 해결되어서 조금 당황했었다(..) 이 예제 코드 전체는 [예제 코드](https://github.com/nevercaution/gradle_info) 에서 확인할 수 있다. 앞으로는 경건한 마음으로 차분하게 살펴보도록 노력하자.










