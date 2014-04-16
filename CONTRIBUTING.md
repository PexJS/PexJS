# CONTRIBUTING

The Pex project welcomes new contributors.  This document will guide you
through the process.


### FORK

Fork the project [on GitHub](https://github.com/PexJS/PexJS) and check out
your copy.

```
$ git clone git@github.com:username/PexJS.git
$ cd PexJS
$ git remote add upstream git://github.com/PexJS/PexJS.git
```

We adopt git-flow model. The rules for develop branch are not strict; you have to
check your code to be run without errors. You don't have any rights to modify
master branch. Master branch is stable and must pass quality assurance tests.


### BRANCH

Create a feature branch and start hacking:

```
$ git checkout -b my-feature-branch
```

### COMMIT

Make sure git knows your name and email address:

```
$ git config --global user.name "Takuo KIHIRA"
$ git config --global user.email "takuo.kihira@example.com"
```

Writing good commit logs is important.  A commit log should describe what
changed and why. 


### REBASE

Use `git rebase` (not `git merge`) to sync your work from time to time.

```
$ git fetch upstream
$ git rebase upstream/develop
```


### PUSH

```
$ git push origin my-feature-branch
```

Go to https://github.com/username/PexJS and select your feature branch.  Click
the 'Pull Request' button and fill out the form.

Pull requests are usually reviewed within a few days.  If there are comments
to address, apply your changes in a separate commit and push that to your
feature branch.  Post a comment in the pull request afterwards; GitHub does
not send out notifications when you add commits.


### CONTRIBUTOR LICENSE AGREEMENT

Please visit https://docs.mobage.com/display/JPHOME/ContributorLicenseAgreement
and sign the Contributor License Agreement.  You only need to do that once.
