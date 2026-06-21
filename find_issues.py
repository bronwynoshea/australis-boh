import re

with open('src/apps/delivery/forge/pages/ForgeManagementPage.tsx', 'r') as f:
    lines = f.readlines()

stack = []
extra_closes = []

for i, line in enumerate(lines, 1):
    opens = re.findall(r'<div\b[^/>]*?[^/]>', line)
    closes = re.findall(r'</div>', line)
    
    for _ in opens:
        stack.append(i)
    
    for _ in closes:
        if stack:
            stack.pop()
        else:
            extra_closes.append(i)

print("Extra closing divs at lines:", extra_closes)
print("Unclosed divs at lines:", stack[-10:] if stack else "None")
