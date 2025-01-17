import Koa from 'koa'
import passport from 'koa-passport'
import Router from 'koa-router'
import { Db } from 'mongodb'
import { registerGoogle } from './google'
import session from 'koa-session'
import { concatLink } from '@hcengineering/core'
import { registerGithub } from './github'

export type Passport = typeof passport

export type AuthProvider = (
  passport: Passport,
  router: Router<any, any>,
  accountsUrl: string,
  db: Db,
  productId: string,
  frontUrl: string
) => string | undefined

export function registerProviders (
  app: Koa<Koa.DefaultState, Koa.DefaultContext>,
  router: Router<any, any>,
  db: Db,
  productId: string,
  serverSecret: string,
  frontUrl: string | undefined
): void {
  const accountsUrl = process.env.ACCOUNTS_URL
  if (accountsUrl === undefined) {
    console.log('Please provide ACCOUNTS_URL url for enable auth providers')
    return
  }

  if (frontUrl === undefined) {
    console.log('Please provide FRONTS_URL url for enable auth providers')
    return
  }

  app.keys = [serverSecret]
  app.use(session({}, app))

  app.use(passport.initialize())
  app.use(passport.session())

  passport.serializeUser(function (user: any, cb) {
    process.nextTick(function () {
      cb(null, { id: user.id, username: user.username, name: user.name })
    })
  })

  passport.deserializeUser(function (user: any, cb) {
    process.nextTick(function () {
      cb(null, user)
    })
  })

  const res: string[] = []
  const providers: AuthProvider[] = [registerGoogle, registerGithub]
  for (const provider of providers) {
    const value = provider(passport, router, accountsUrl, db, productId, frontUrl)
    if (value !== undefined) res.push(value)
  }

  router.get('auth', '/auth', (ctx) => {
    if (ctx.session?.loginInfo != null) {
      ctx.body = JSON.stringify(ctx.session?.loginInfo)
      return
    }
    ctx.redirect(concatLink(frontUrl, '/login'))
  })

  router.get('providers', '/providers', (ctx) => {
    ctx.body = JSON.stringify(res)
  })
}
