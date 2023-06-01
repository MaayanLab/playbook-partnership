import fs from 'fs'
import glob from 'glob'
import path from 'path'

const base = path.join(__dirname, '..')
const requirements = [...glob.sync(path.join(base, 'components', '**', 'requirements.txt').split(path.sep).join(path.posix.sep))
  .flatMap(p => fs.readFileSync(p).toString().replaceAll(/\s*(#.*)?$/g, '').split(/\r?\n/g))
  .reduce((requirements, requirement) => requirements.add(requirement), new Set())]
requirements.sort()

fs.writeFileSync(path.join(base, 'requirements.txt'), requirements.join('\n'))
