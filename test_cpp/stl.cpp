#include<iostream>
// #include<set>
#include <bits/stdc++.h>
using namespace std;
int glo = 10;
int main(){
    map<int,int> mp;
    set< int > s;
    multiset< int > ms;
    bitset<10> bs;
    priority_queue<int> pq;
    for(int i = 0; i < 10; ++i) {
        s.insert(i*i);
        ms.insert(i+1);ms.insert(i*i);
        mp[i] = i*i;
        if(i&1) bs.set(i);
        pq.push(i);
    }
    
    cout << s.size() << " " << *s.begin() << "\n";

}